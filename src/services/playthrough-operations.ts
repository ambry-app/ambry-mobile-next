/**
 * Playthrough Operations Service
 *
 * Handles all playthrough state transitions using event-first pattern:
 * - Starting: create new, continue existing, resume finished/abandoned
 * - Ending: finish, abandon, delete
 *
 * V2 Architecture: All operations work by inserting events, then rebuilding
 * playthrough state from those events. Playthroughs are NEVER directly mutated.
 *
 * This is the single source of truth for:
 * - Recording lifecycle events (start, resume, finish, abandon, delete)
 * - Rebuilding playthrough state from events
 * - Loading playthroughs into TrackPlayer
 * - Managing active playthrough for device
 * - Bumping data version for UI refresh
 * - Triggering sync
 */

import { rebuildPlaythrough } from "@/db/playthrough-reducer";
import {
  clearActivePlaythroughIdForDevice,
  createLifecycleEvent,
  createStartEvent,
  getActivePlaythroughIdForDevice,
  getPlaythroughWithMedia,
  insertEvent,
  setActivePlaythroughIdForDevice,
} from "@/db/playthroughs";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { getDeviceInfo } from "@/stores/device";
import { useSession } from "@/stores/session";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

import { syncPlaybackEvents } from "./sync-service";
import * as Player from "./track-player-service";

const log = logBase.extend("playthrough-ops");

// =============================================================================
// Starting Operations
// =============================================================================

/**
 * Start a brand new playthrough for media.
 *
 * V2: Creates a "start" event, rebuilds playthrough from event, loads into TrackPlayer.
 *
 * Use when: User taps play on media that has no existing playthrough,
 * or user chooses "Start Fresh" to create a new playthrough.
 *
 * Caller is responsible for starting playback.
 */
export async function startNewPlaythrough(
  session: Session,
  mediaId: string,
): Promise<void> {
  const deviceId = (await getDeviceInfo()).id;

  // Create and insert start event
  const { playthroughId, event } = createStartEvent(mediaId, deviceId);
  await insertEvent(event);

  // Rebuild playthrough from event
  await rebuildPlaythrough(playthroughId, session);

  // Get the new playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  log.info(`Started new playthrough: ${playthroughId} for media: ${mediaId}`);
}

/**
 * Continue an existing in_progress playthrough.
 *
 * Just loads - no status change needed since playthrough is
 * already in_progress.
 *
 * Use when: User taps play on media that has an in_progress playthrough.
 *
 * Caller is responsible for starting playback.
 */
export async function continuePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<void> {
  // Get the playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  log.info(`Continuing playthrough: ${playthroughId}`);
}

/**
 * Resume a finished or abandoned playthrough.
 *
 * V2: Creates a "resume" event, rebuilds playthrough from events, loads into player.
 *
 * Use when: User chooses to resume from ResumePlaythroughDialog.
 *
 * Caller is responsible for starting playback.
 */
export async function resumePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<void> {
  const deviceId = (await getDeviceInfo()).id;

  // Create and insert resume event
  const event = createLifecycleEvent(playthroughId, deviceId, "resume");
  await insertEvent(event);

  // Rebuild playthrough from all events
  await rebuildPlaythrough(playthroughId, session);

  // Get the now-active playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  log.info(`Resumed playthrough: ${playthroughId}`);
}

// =============================================================================
// Ending Operations
// =============================================================================

/**
 * Finalize a playthrough as finished.
 *
 * V2: Creates a "finish" event, rebuilds playthrough from events.
 *
 * This handles all the bookkeeping for marking a playthrough complete:
 * 1. Inserts "finish" lifecycle event
 * 2. Rebuilds playthrough state from events
 * 3. Clears active playthrough for this device
 * 4. Bumps data version for UI refresh
 * 5. Triggers sync in background
 *
 * @param session - Current session (or null to use current session from store)
 * @param playthroughId - ID of the playthrough to finish
 */
export async function finishPlaythrough(
  session: Session | null,
  playthroughId: string,
): Promise<void> {
  const resolvedSession = session ?? useSession.getState().session;
  if (!resolvedSession) {
    log.warn("No session, cannot finish playthrough");
    return;
  }

  const deviceId = (await getDeviceInfo()).id;

  log.info("Finishing playthrough:", playthroughId);

  // Create and insert finish event
  const event = createLifecycleEvent(playthroughId, deviceId, "finish");
  await insertEvent(event);

  // Rebuild playthrough from all events
  await rebuildPlaythrough(playthroughId, resolvedSession);

  // Clear the active playthrough for this device since it's finished
  await clearActivePlaythroughIdForDevice(resolvedSession);

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Trigger sync in background (non-blocking)
  triggerBackgroundSync(resolvedSession);
}

/**
 * Finalize a playthrough as abandoned.
 *
 * V2: Creates an "abandon" event, rebuilds playthrough from events.
 *
 * This handles all the bookkeeping for marking a playthrough abandoned:
 * 1. Inserts "abandon" lifecycle event
 * 2. Rebuilds playthrough state from events
 * 3. Clears active playthrough for this device
 * 4. Bumps data version for UI refresh
 * 5. Triggers sync in background
 *
 * @param session - Current session (or null to use current session from store)
 * @param playthroughId - ID of the playthrough to abandon
 */
export async function abandonPlaythrough(
  session: Session | null,
  playthroughId: string,
): Promise<void> {
  const resolvedSession = session ?? useSession.getState().session;
  if (!resolvedSession) {
    log.warn("No session, cannot abandon playthrough");
    return;
  }

  const deviceId = (await getDeviceInfo()).id;

  log.info("Abandoning playthrough:", playthroughId);

  // Create and insert abandon event
  const event = createLifecycleEvent(playthroughId, deviceId, "abandon");
  await insertEvent(event);

  // Rebuild playthrough from all events
  await rebuildPlaythrough(playthroughId, resolvedSession);

  // Clear the active playthrough for this device since it's abandoned
  await clearActivePlaythroughIdForDevice(resolvedSession);

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Trigger sync in background (non-blocking)
  triggerBackgroundSync(resolvedSession);
}

/**
 * Delete a playthrough.
 *
 * V2: Creates a "delete" event, rebuilds playthrough from events.
 *
 * This handles all the bookkeeping for deleting a playthrough:
 * 1. Inserts "delete" lifecycle event
 * 2. Rebuilds playthrough state from events (sets status=deleted, deletedAt)
 * 3. Bumps data version for UI refresh
 * 4. Triggers sync in background
 *
 * @param session - Current session
 * @param playthroughId - ID of the playthrough to delete
 */
export async function deletePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<void> {
  const deviceId = (await getDeviceInfo()).id;

  log.info("Deleting playthrough:", playthroughId);

  // Create and insert delete event
  const event = createLifecycleEvent(playthroughId, deviceId, "delete");
  await insertEvent(event);

  // Rebuild playthrough from all events
  await rebuildPlaythrough(playthroughId, session);

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Trigger sync in background (non-blocking)
  triggerBackgroundSync(session);
}

// =============================================================================
// Special-Case Loading Functions
// =============================================================================

/**
 * Load the stored active playthrough into TrackPlayer.
 *
 * Used during app initialization to restore the last playing media.
 * Returns null if no active playthrough is stored for this device.
 *
 * Note: This function does NOT start playback, only loads.
 * Note: If the stored playthrough is invalid (deleted, finished, abandoned),
 * it clears the stored ID and returns null.
 */
export async function loadActivePlaythroughIntoPlayer(
  session: Session,
): Promise<void> {
  // Check for stored active playthrough ID for this device
  const storedPlaythroughId = await getActivePlaythroughIdForDevice(session);

  if (!storedPlaythroughId) {
    log.info("No active playthrough stored for this device");
    return;
  }

  // Verify the stored playthrough exists and is in_progress
  const playthrough = await getPlaythroughWithMedia(
    session,
    storedPlaythroughId,
  );

  if (playthrough.status !== "in_progress") {
    log.debug(
      `Stored playthrough is not in_progress (status: ${playthrough.status}), clearing: ${storedPlaythroughId}`,
    );
    await clearActivePlaythroughIdForDevice(session);
    return;
  }

  log.info(
    `Loading stored active playthrough: ${playthrough.id}, mediaId: ${playthrough.media.id}`,
  );

  await Player.loadPlaythroughIntoPlayer(session, playthrough);
}

/**
 * Reload a specific playthrough by ID.
 *
 * Used when we need to reload the currently loaded playthrough,
 * such as when switching between streaming and downloaded audio.
 *
 * Note: This function does NOT start playback, only loads.
 */
export async function reloadPlaythroughById(
  session: Session,
  playthroughId: string,
): Promise<void> {
  log.info("Reloading playthrough by ID:", playthroughId);

  const playthrough = await getPlaythroughWithMedia(session, playthroughId);

  await Player.loadPlaythroughIntoPlayer(session, playthrough);
}

/**
 * Clear the active playthrough for this device.
 *
 * Used for user-initiated "unload player" actions (e.g., from context menu).
 * Unlike logout/session expiry (which preserves the active playthrough ID for
 * next login), this clears it so the player stays unloaded on next app boot.
 *
 * Caller is responsible for actually unloading the player.
 */
export async function clearActivePlaythrough(session: Session): Promise<void> {
  await clearActivePlaythroughIdForDevice(session);
}

// =============================================================================
// Internal Helpers
// =============================================================================

function triggerBackgroundSync(session: Session) {
  syncPlaybackEvents(session);
}
