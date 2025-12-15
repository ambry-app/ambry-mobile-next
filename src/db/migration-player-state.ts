import Storage from "expo-sqlite/kv-store";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { randomUUID } from "@/utils/crypto";

interface OldPlayerState {
  url: string;
  userEmail: string;
  mediaId: string;
  position: number;
  playbackRate: number;
  status: "not_started" | "in_progress" | "finished";
  insertedAt: number; // When user first started (Unix seconds)
  updatedAt: number; // When user last played (Unix seconds)
}

/**
 * Checks if the PlayerState migration needs to be run.
 *
 * Returns true if migration is needed (flag not set and old data exists).
 */
export async function needsPlayerStateMigration(): Promise<boolean> {
  // Check if migration has already been completed
  const migrated = await Storage.getItem("playerstate_migration_v1");
  if (migrated === "completed") {
    console.debug("[Migration] Migration already completed (flag set)");
    return false;
  }

  const db = getDb();

  // Check if old player_states table exists and has data
  try {
    const results = await db.select().from(schema.playerStates).limit(1);
    const hasData = results.length > 0;

    if (hasData) {
      console.debug(
        "[Migration] Found old player_states data, migration needed",
      );
    } else {
      console.debug("[Migration] No old player_states data found");
    }

    return hasData;
  } catch {
    console.debug("[Migration] player_states table not found");
    return false;
  }
}

/**
 * Migrates from old PlayerState schema to new Playthrough schema.
 *
 * This migration:
 * 1. Reads ALL old PlayerState records (for all users/sessions)
 * 2. Creates Playthrough records with synthetic events
 * 3. Marks them for sync (syncedAt = null)
 * 4. Sets completion flag (tables will be dropped via Drizzle migration later)
 *
 * Client-side migration approach: Client is source of truth.
 * Server receives these playthroughs as NEW data when client syncs up.
 *
 * Note: Migrates all users' states at once to avoid data loss if user
 * switches accounts. DeviceId is set to null for synthetic events since
 * we don't know which device created the original states.
 *
 * This runs BEFORE any session-dependent initialization and does not
 * require a logged-in user.
 */
export async function migrateFromPlayerStateToPlaythrough(): Promise<void> {
  console.debug("[Migration] Starting PlayerState → Playthrough migration");

  const db = getDb();

  // Clean up any partial migration data from previous incomplete run
  // Safe to delete all playthroughs because migration blocks app boot,
  // so user cannot have created any real playthroughs yet
  console.debug("[Migration] Cleaning up any partial migration data");
  await db.delete(schema.playthroughStateCache);
  await db.delete(schema.playbackEvents);
  await db.delete(schema.playthroughs);

  // Fetch from both tables: synced player_states and local_player_states
  // Use try-catch in case tables don't exist (fresh install)
  let syncedStates: OldPlayerState[] = [];
  try {
    const results = await db.select().from(schema.playerStates);
    syncedStates = results.map((row) => ({
      url: row.url,
      userEmail: row.userEmail,
      mediaId: row.mediaId,
      position: row.position,
      playbackRate: row.playbackRate,
      status: row.status,
      insertedAt: Math.floor(row.insertedAt.getTime() / 1000), // Convert Date to Unix seconds
      updatedAt: Math.floor(row.updatedAt.getTime() / 1000),
    }));
  } catch {
    console.debug("[Migration] player_states table not found or empty");
  }

  let localStates: OldPlayerState[] = [];
  try {
    const results = await db.select().from(schema.localPlayerStates);
    localStates = results.map((row) => ({
      url: row.url,
      userEmail: row.userEmail,
      mediaId: row.mediaId,
      position: row.position,
      playbackRate: row.playbackRate,
      status: row.status,
      insertedAt: Math.floor(row.insertedAt.getTime() / 1000),
      updatedAt: Math.floor(row.updatedAt.getTime() / 1000),
    }));
  } catch {
    console.debug("[Migration] local_player_states table not found or empty");
  }

  console.debug(
    `[Migration] Found ${syncedStates.length} synced states, ${localStates.length} local states`,
  );

  // Coalesce: for each (url, userEmail, mediaId), prefer local over synced
  // Local has real user activity timestamps, synced has server sync timestamps
  const stateMap = new Map<string, OldPlayerState>();

  // Add synced states first
  for (const state of syncedStates) {
    const key = `${state.url}::${state.userEmail}::${state.mediaId}`;
    stateMap.set(key, state);
  }

  // Add local states (always overwrite synced - local is source of truth)
  for (const state of localStates) {
    const key = `${state.url}::${state.userEmail}::${state.mediaId}`;
    stateMap.set(key, state);
  }

  const oldPlayerStates = Array.from(stateMap.values());
  console.debug(
    `[Migration] Coalesced to ${oldPlayerStates.length} unique player states`,
  );

  // We don't use deviceId for synthetic events since we don't know
  // which device originally created each state
  const deviceId = null;

  for (const playerState of oldPlayerStates) {
    // Skip not_started states (in new model, no playthrough = not started)
    if (playerState.status === "not_started") {
      console.debug(
        `[Migration] Skipping not_started state for ${playerState.mediaId}`,
      );
      continue;
    }

    console.debug(
      `[Migration] Migrating player state for ${playerState.userEmail}@${playerState.url}/${playerState.mediaId}`,
    );

    const now = new Date();
    const playthroughId = randomUUID();
    // SQLite timestamps are in seconds, convert to milliseconds for Date
    const startedAt = new Date(playerState.insertedAt * 1000);
    const updatedAt = new Date(playerState.updatedAt * 1000);

    // Create playthrough (use playerState's url/email, not current session)
    await db.insert(schema.playthroughs).values({
      id: playthroughId,
      url: playerState.url,
      userEmail: playerState.userEmail,
      mediaId: playerState.mediaId,
      status: playerState.status === "finished" ? "finished" : "in_progress",
      startedAt, // When user first started playing
      finishedAt: playerState.status === "finished" ? updatedAt : null,
      createdAt: now, // Migration time
      updatedAt, // When user last played (for ordering)
      syncedAt: null, // Mark for sync
    });

    // Create synthetic pause event with old position/rate
    await db.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId,
      type: "pause",
      timestamp: updatedAt, // When user last played
      position: playerState.position,
      playbackRate: playerState.playbackRate,
      syncedAt: null, // Mark for sync
    });

    // If finished, create finish event
    if (playerState.status === "finished") {
      await db.insert(schema.playbackEvents).values({
        id: randomUUID(),
        playthroughId,
        deviceId,
        type: "finish",
        timestamp: updatedAt, // When user finished
        syncedAt: null, // Mark for sync
      });
    }

    // Create state cache for this playthrough
    await db.insert(schema.playthroughStateCache).values({
      playthroughId,
      currentPosition: playerState.position,
      currentRate: playerState.playbackRate,
      lastEventAt: updatedAt, // When user last played
      totalListeningTime: 0, // Can't calculate from single pause event
      updatedAt, // Match playthrough's updatedAt
    });
  }

  console.debug("[Migration] Setting completion flag");

  // Mark migration as complete
  // Tables will be dropped via Drizzle migration later (after all users have migrated)
  await Storage.setItem("playerstate_migration_v1", "completed");

  console.debug("[Migration] Migration complete");
}
