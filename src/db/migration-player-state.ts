import { getDb, getExpoDb } from "@/db/db";
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
 * Detects if the old PlayerState schema exists in the database.
 *
 * Returns true if migration is needed.
 */
export async function detectOldPlayerStateSchema(): Promise<boolean> {
  const db = getExpoDb();

  // Check if old player_states table exists
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='player_states'",
  );

  return (result?.count ?? 0) > 0;
}

/**
 * Migrates from old PlayerState schema to new Playthrough schema.
 *
 * This migration:
 * 1. Reads ALL old PlayerState records (for all users/sessions)
 * 2. Creates Playthrough records with synthetic events
 * 3. Marks them for sync (syncedAt = null)
 * 4. Drops old tables
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
  console.log("[Migration] Starting PlayerState → Playthrough migration");

  const expoDb = getExpoDb();
  const db = getDb();

  // Fetch from both tables: synced player_states and local_player_states
  // Use try-catch in case one table doesn't exist
  let syncedStates: OldPlayerState[] = [];
  try {
    syncedStates = expoDb.getAllSync<OldPlayerState>(
      `SELECT url, user_email as userEmail, media_id as mediaId, position, playback_rate as playbackRate, status, inserted_at as insertedAt, updated_at as updatedAt FROM player_states`,
    );
  } catch {
    console.log("[Migration] player_states table not found or empty");
  }

  let localStates: OldPlayerState[] = [];
  try {
    localStates = expoDb.getAllSync<OldPlayerState>(
      `SELECT url, user_email as userEmail, media_id as mediaId, position, playback_rate as playbackRate, status, inserted_at as insertedAt, updated_at as updatedAt FROM local_player_states`,
    );
  } catch {
    console.log("[Migration] local_player_states table not found or empty");
  }

  console.log(
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
  console.log(
    `[Migration] Coalesced to ${oldPlayerStates.length} unique player states`,
  );

  // We don't use deviceId for synthetic events since we don't know
  // which device originally created each state
  const deviceId = null;

  for (const playerState of oldPlayerStates) {
    // Skip not_started states (in new model, no playthrough = not started)
    if (playerState.status === "not_started") {
      console.log(
        `[Migration] Skipping not_started state for ${playerState.mediaId}`,
      );
      continue;
    }

    console.log(
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

  console.log("[Migration] Dropping old player_states tables");

  // Drop old tables
  expoDb.execSync("DROP TABLE IF EXISTS player_states");
  expoDb.execSync("DROP TABLE IF EXISTS local_player_states");

  console.log("[Migration] Migration complete");
}
