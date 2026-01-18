/**
 * Legacy PlayerState Migration
 *
 * Migrates from old snapshot-based PlayerState model (one record per media)
 * to new event-sourced Playthrough model.
 *
 * V2: Creates events only, then rebuilds playthroughs from events.
 * This ensures the same logic is used everywhere.
 */

import Storage from "expo-sqlite/kv-store";

import { getDb } from "@/db/db";
import { rebuildPlaythrough } from "@/db/playthrough-reducer";
import * as schema from "@/db/schema";
import { randomUUID } from "@/utils/crypto";
import { logBase } from "@/utils/logger";

const log = logBase.extend("migration");

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
    log.debug("Migration already completed (flag set)");
    return false;
  }

  const db = getDb();

  // Check if old player_states table exists and has data
  try {
    const playerStateResults = await db
      .select()
      .from(schema.playerStates)
      .limit(1);
    const hasPlayerStates = playerStateResults.length > 0;

    const localPlayerStateResults = await db
      .select()
      .from(schema.localPlayerStates)
      .limit(1);
    const hasLocalPlayerStates = localPlayerStateResults.length > 0;

    if (hasPlayerStates || hasLocalPlayerStates) {
      log.debug("Found old player_states data, migration needed");
    } else {
      log.debug("No old player_states data found");
    }

    return hasPlayerStates || hasLocalPlayerStates;
  } catch {
    log.debug("player_states or local_player_states table not found");
    return false;
  }
}

/**
 * Migrates from old PlayerState schema to new Playthrough schema.
 *
 * V2: This migration now:
 * 1. Reads ALL old PlayerState records (for all users/sessions)
 * 2. Creates synthetic events for each state
 * 3. Rebuilds playthroughs from those events using the shared reducer
 * 4. Creates state cache entries for crash recovery
 * 5. Sets completion flag
 *
 * Client-side migration approach: Client is source of truth.
 * Server receives these events as NEW data when client syncs up.
 *
 * Note: Migrates all users' states at once to avoid data loss if user
 * switches accounts.
 *
 * This runs BEFORE any session-dependent initialization and does not
 * require a logged-in user.
 *
 * @param deviceId - The current device ID to associate with synthetic events
 */
export async function migrateFromPlayerStateToPlaythrough(
  deviceId: string,
): Promise<void> {
  log.info("Starting PlayerState → Playthrough migration (V2)");

  const db = getDb();

  // Clean up any partial migration data from previous incomplete run
  // Safe to delete all playthroughs because migration blocks app boot,
  // so user cannot have created any real playthroughs yet
  log.debug("Cleaning up any partial migration data");
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
    log.debug("player_states table not found or empty");
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
    log.debug("local_player_states table not found or empty");
  }

  log.debug(
    `Found ${syncedStates.length} synced states, ${localStates.length} local states`,
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
  log.debug(`Coalesced to ${oldPlayerStates.length} unique player states`);

  // Use the provided device ID for synthetic events.
  // While we don't know which device originally created each state,
  // we use the current device ID since this device is performing the migration.

  for (const playerState of oldPlayerStates) {
    // Skip not_started states (in new model, no playthrough = not started)
    if (playerState.status === "not_started") {
      log.debug(`Skipping not_started state for ${playerState.mediaId}`);
      continue;
    }

    log.debug(
      `Migrating player state for ${playerState.userEmail}@${playerState.url}/${playerState.mediaId}`,
    );

    const playthroughId = randomUUID();

    // Create ordered timestamps for synthetic events.
    // Timestamps can be identical in source data, so we add 1ms offsets
    // to ensure they are always in chronological order for sorting.
    const startTs = new Date(playerState.insertedAt * 1000);
    let pauseTs = new Date(playerState.updatedAt * 1000);

    // Ensure pause is after start
    if (pauseTs.getTime() <= startTs.getTime()) {
      pauseTs = new Date(startTs.getTime() + 1);
    }

    let finishTs: Date | null = null;
    if (playerState.status === "finished") {
      // Ensure finish is after pause
      finishTs = new Date(pauseTs.getTime() + 1);
    }

    // The last event timestamp will be used for the state cache
    const lastEventTs = finishTs ?? pauseTs;

    // Create synthetic start event
    await db.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId,
      mediaId: playerState.mediaId, // Identifies the media being played
      type: "start",
      timestamp: startTs, // When user first started playing
      position: 0, // Start events always begin at position 0
      playbackRate: playerState.playbackRate,
      syncedAt: null, // Mark for sync
    });

    // Create synthetic pause event with current position/rate
    await db.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId,
      type: "pause",
      timestamp: pauseTs, // When user last played
      position: playerState.position,
      syncedAt: null, // Mark for sync
    });

    // If finished, create finish event
    if (playerState.status === "finished") {
      await db.insert(schema.playbackEvents).values({
        id: randomUUID(),
        playthroughId,
        deviceId,
        type: "finish",
        timestamp: finishTs!, // When user finished
        syncedAt: null, // Mark for sync
      });
    }

    // Rebuild playthrough from events using the shared reducer
    // This creates the playthrough record with correct derived state
    await rebuildPlaythrough(
      playthroughId,
      {
        url: playerState.url,
        email: playerState.userEmail,
        token: "", // Not used by rebuildPlaythrough
      },
      db,
      new Date(),
    );

    // Create state cache for crash recovery
    await db.insert(schema.playthroughStateCache).values({
      playthroughId,
      position: playerState.position,
      updatedAt: lastEventTs, // Match playthrough's lastEventAt
    });
  }

  log.debug("Setting completion flag");

  // Mark migration as complete
  // Tables will be dropped via Drizzle migration later (after all users have migrated)
  await Storage.setItem("playerstate_migration_v1", "completed");

  log.info("Migration complete");
}
