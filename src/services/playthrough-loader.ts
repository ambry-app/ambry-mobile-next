/**
 * Playthrough Loading Service
 *
 * Explicit functions for loading playthroughs into TrackPlayer.
 * These functions do NO decision logic (caller decides which to call):
 * - startNewPlaythrough: creates and loads a new playthrough
 * - continuePlaythrough: loads an existing in_progress playthrough
 * - resumePlaythrough: changes status and loads a finished/abandoned playthrough
 *
 * The caller is responsible for deciding which function to call.
 * This removes hidden queries and makes the code flow explicit.
 *
 * Also includes:
 * - loadActivePlaythroughIntoPlayer: for app initialization
 * - reloadPlaythroughById: for reloading after download completes
 * - clearActivePlaythrough: for user-initiated unload
 */

import { PAUSE_REWIND_SECONDS } from "@/constants";
import {
  clearActivePlaythroughIdForDevice,
  createPlaythrough,
  getActivePlaythroughIdForDevice,
  getPlaythroughWithMedia,
  resumePlaythrough as resumePlaythroughInDb,
  setActivePlaythroughIdForDevice,
} from "@/db/playthroughs";
import { PlayPauseSource } from "@/stores/track-player";
import { Session } from "@/types/session";

import * as EventRecording from "./event-recording";
import { seekImmediateNoLog } from "./seek-service";
import * as Player from "./track-player-service";

// =============================================================================
// Explicit User-Action Functions
// =============================================================================

/**
 * Start a brand new playthrough for media.
 *
 * Creates a new playthrough, records "start" event, loads into TrackPlayer,
 * and sets as active.
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
  await pauseCurrentIfPlaying();

  // Create new playthrough and record start event
  const playthroughId = await createPlaythrough(session, mediaId);
  await EventRecording.recordStartEvent(playthroughId);

  // Get the new playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);
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
  await pauseCurrentIfPlaying();

  // Get the playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);
}

/**
 * Resume a finished or abandoned playthrough.
 *
 * Marks as in_progress, records "resume" event, and loads.
 *
 * Use when: User chooses to resume from ResumePlaythroughDialog.
 *
 * Caller is responsible for starting playback.
 */
export async function resumePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<void> {
  await pauseCurrentIfPlaying();

  // Mark as in_progress in database and record resume event
  await resumePlaythroughInDb(session, playthroughId);
  await EventRecording.recordResumeEvent(playthroughId);

  // Get the now-active playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  await Player.loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);
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
    console.debug("[Loader] No active playthrough stored for this device");
    return;
  }

  // Verify the stored playthrough exists and is in_progress
  const playthrough = await getPlaythroughWithMedia(
    session,
    storedPlaythroughId,
  );

  if (playthrough.status !== "in_progress") {
    console.debug(
      "[Loader] Stored playthrough is not in_progress (status:",
      playthrough.status,
      "), clearing:",
      storedPlaythroughId,
    );
    await clearActivePlaythroughIdForDevice(session);
    return;
  }

  console.debug(
    "[Loader] Loading stored active playthrough:",
    playthrough.id,
    "mediaId:",
    playthrough.media.id,
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
  console.debug("[Loader] Reloading playthrough by ID:", playthroughId);

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

/**
 * Pause current playback if playing and record the pause event.
 * No-op if nothing is playing.
 */
async function pauseCurrentIfPlaying() {
  const isPlaying = Player.isPlaying();
  if (!isPlaying.playing) return;

  console.debug("[Loader] Pausing current playback before transition");
  await Player.pause(PlayPauseSource.USER);
  await seekImmediateNoLog(-PAUSE_REWIND_SECONDS);
}
