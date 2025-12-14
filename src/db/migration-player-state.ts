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
  updatedAt: number;
}

/**
 * Detects if the old PlayerState schema exists in the database.
 *
 * Returns true if migration is needed.
 */
export async function detectOldPlayerStateSchema(): Promise<boolean> {
  const db = getExpoDb();

  // Check if old playerStates table exists
  const result = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='playerStates'",
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

  // Fetch ALL old player states (not just current session)
  const oldPlayerStates = expoDb.getAllSync<OldPlayerState>(
    `SELECT * FROM playerStates`,
  );

  console.log(`[Migration] Found ${oldPlayerStates.length} old player states`);

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

    // Create playthrough (use playerState's url/email, not current session)
    await db.insert(schema.playthroughs).values({
      id: playthroughId,
      url: playerState.url,
      userEmail: playerState.userEmail,
      mediaId: playerState.mediaId,
      status: playerState.status === "finished" ? "finished" : "in_progress",
      startedAt: new Date(playerState.updatedAt),
      finishedAt:
        playerState.status === "finished"
          ? new Date(playerState.updatedAt)
          : null,
      createdAt: now,
      updatedAt: now,
      syncedAt: null, // Mark for sync
    });

    // Create synthetic pause event with old position/rate
    await db.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId,
      type: "pause",
      timestamp: new Date(playerState.updatedAt),
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
        timestamp: new Date(playerState.updatedAt),
        syncedAt: null, // Mark for sync
      });
    }

    // Create state cache for this playthrough
    await db.insert(schema.playthroughStateCache).values({
      playthroughId,
      currentPosition: playerState.position,
      currentRate: playerState.playbackRate,
      lastEventAt: new Date(playerState.updatedAt),
      totalListeningTime: 0, // Can't calculate from single pause event
      updatedAt: now,
    });
  }

  console.log("[Migration] Dropping old playerStates tables");

  // Drop old tables
  expoDb.execSync("DROP TABLE IF EXISTS playerStates");
  expoDb.execSync("DROP TABLE IF EXISTS localPlayerStates");

  console.log("[Migration] Migration complete");
}
