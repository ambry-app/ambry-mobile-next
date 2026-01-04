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

import { Platform } from "react-native";

import { PAUSE_REWIND_SECONDS } from "@/constants";
import {
  type ActivePlaythrough,
  clearActivePlaythroughIdForDevice,
  createPlaythrough,
  getActivePlaythroughIdForDevice,
  getPlaythroughWithMedia,
  resumePlaythrough as resumePlaythroughInDb,
  setActivePlaythroughIdForDevice,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Session } from "@/types/session";
import { Capability, PitchAlgorithm, TrackType } from "@/types/track-player";
import { documentDirectoryFilePath } from "@/utils";

import * as EventRecording from "./event-recording";
import * as Heartbeat from "./position-heartbeat";
import * as SleepTimer from "./sleep-timer-service";
import { syncPlaythroughs } from "./sync-service";
import * as Player from "./track-player-service";
import { setRate } from "./track-player-service";

// =============================================================================
// Types
// =============================================================================

export interface TrackLoadResult {
  playthroughId: string;
  mediaId: string;
  duration: number;
  position: number;
  playbackRate: number;
  streaming: boolean;
  chapters: schema.Chapter[];
}

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
 * Returns TrackLoadResult for caller to update player state.
 * Caller is responsible for starting playback.
 */
export async function startNewPlaythrough(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  // Create new playthrough and record start event
  const playthroughId = await createPlaythrough(session, mediaId);
  await EventRecording.recordStartEvent(playthroughId);

  // Get the new playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  if (!playthrough) {
    throw new Error(`Playthrough not found after create: ${playthroughId}`);
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  return result;
}

/**
 * Continue an existing in_progress playthrough.
 *
 * Just loads - no status change needed since playthrough is
 * already in_progress.
 *
 * Use when: User taps play on media that has an in_progress playthrough.
 *
 * Returns TrackLoadResult for caller to update player state.
 * Caller is responsible for starting playback.
 */
export async function continuePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  // Get the playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  if (!playthrough) {
    throw new Error(`Playthrough not found: ${playthroughId}`);
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  return result;
}

/**
 * Resume a finished or abandoned playthrough.
 *
 * Marks as in_progress, records "resume" event, and loads.
 *
 * Use when: User chooses to resume from ResumePlaythroughDialog.
 *
 * Returns TrackLoadResult for caller to update player state.
 * Caller is responsible for starting playback.
 */
export async function resumePlaythrough(
  session: Session,
  playthroughId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  // Mark as in_progress in database and record resume event
  await resumePlaythroughInDb(session, playthroughId);
  await EventRecording.recordResumeEvent(playthroughId);

  // Get the now-active playthrough with full media info
  const playthrough = await getPlaythroughWithMedia(session, playthroughId);
  if (!playthrough) {
    throw new Error(`Playthrough not found after resume: ${playthroughId}`);
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  return result;
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
): Promise<TrackLoadResult | null> {
  const track = await Player.getTrack(0);

  if (track) {
    // Track already loaded (e.g., from headless context or previous session)
    // The description field contains the playthroughId
    const playthroughId = track.description!;
    const streaming = track.url.startsWith("http");
    const playbackRate = await Player.getPlaybackRate();
    const progress = await Player.getAccurateProgress();
    const position = progress.position;
    const duration = progress.duration;

    // Get playthrough with full media info
    const playthrough = await getPlaythroughWithMedia(session, playthroughId);

    if (!playthrough) {
      console.warn(
        "[Loader] Track loaded but playthrough not found:",
        playthroughId,
      );
      return null;
    }

    return {
      playthroughId,
      mediaId: playthrough.media.id,
      position,
      duration,
      playbackRate,
      streaming,
      chapters: playthrough.media.chapters,
    };
  }

  // Check for stored active playthrough ID for this device
  const storedPlaythroughId = await getActivePlaythroughIdForDevice(session);

  if (!storedPlaythroughId) {
    console.debug("[Loader] No active playthrough stored for this device");
    return null;
  }

  // Verify the stored playthrough exists and is in_progress
  const playthrough = await getPlaythroughWithMedia(
    session,
    storedPlaythroughId,
  );

  if (!playthrough) {
    console.debug(
      "[Loader] Stored playthrough not found, clearing:",
      storedPlaythroughId,
    );
    await clearActivePlaythroughIdForDevice(session);
    return null;
  }

  if (playthrough.status !== "in_progress") {
    console.debug(
      "[Loader] Stored playthrough is not in_progress (status:",
      playthrough.status,
      "), clearing:",
      storedPlaythroughId,
    );
    await clearActivePlaythroughIdForDevice(session);
    return null;
  }

  console.debug(
    "[Loader] Loading stored active playthrough:",
    playthrough.id,
    "mediaId:",
    playthrough.media.id,
  );

  return loadPlaythroughIntoPlayer(session, playthrough);
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
): Promise<TrackLoadResult> {
  console.debug("[Loader] Reloading playthrough by ID:", playthroughId);

  const playthrough = await getPlaythroughWithMedia(session, playthroughId);

  if (!playthrough) {
    throw new Error(`Playthrough not found: ${playthroughId}`);
  }

  return loadPlaythroughIntoPlayer(session, playthrough);
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
 * Wait for TrackPlayer to report a position close to the expected position.
 * This is needed because seekTo() can return before the seek actually completes,
 * especially for streaming content.
 *
 * @param expectedPosition - The position we seeked to
 * @param timeoutMs - Maximum time to wait (default 2000ms)
 * @param toleranceSeconds - How close is "close enough" (default 5 seconds)
 * @returns The actual position reported by TrackPlayer
 */
async function waitForSeekToComplete(
  expectedPosition: number,
  timeoutMs: number = 2000,
  toleranceSeconds: number = 5,
): Promise<number> {
  const startTime = Date.now();
  const pollIntervalMs = 50;

  while (Date.now() - startTime < timeoutMs) {
    const { position } = await Player.getAccurateProgress();

    // If seeking to 0, just accept any position (including 0)
    if (expectedPosition === 0) {
      return position;
    }

    // Check if position is close enough to expected
    if (Math.abs(position - expectedPosition) < toleranceSeconds) {
      return position;
    }

    // Also accept if position is non-zero and we're seeking to non-zero
    // (handles cases where exact position might differ slightly)
    if (position > 0) {
      return position;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - return whatever position we have
  const { position } = await Player.getAccurateProgress();
  console.warn(
    "[Loader] waitForSeekToComplete timed out. Expected:",
    expectedPosition.toFixed(2),
    "Got:",
    position.toFixed(2),
  );
  return position;
}

/**
 * Pause current playback if playing and record the pause event.
 * No-op if nothing is playing.
 */
async function pauseCurrentIfPlaying() {
  const isPlaying = Player.isPlaying();
  if (!isPlaying.playing) return;

  console.debug("[Loader] Pausing current playback before transition");
  await Player.pause();

  // Rewind slightly so the user has context when they resume
  // (see PAUSE_REWIND_SECONDS in constants.ts for explanation)

  const playbackRate = await Player.getPlaybackRate();
  const progress = await Player.getAccurateProgress();
  let seekPosition = progress.position - PAUSE_REWIND_SECONDS * playbackRate;
  seekPosition = Math.max(0, Math.min(seekPosition, progress.duration));
  await Player.seekTo(seekPosition);

  Heartbeat.stop();

  const playthrough = useTrackPlayer.getState().playthrough;

  if (playthrough) {
    try {
      await EventRecording.recordPauseEvent(
        playthrough.id,
        seekPosition, // Use rewound position
        playbackRate,
      );
    } catch (error) {
      console.warn("[Loader] Error recording pause event:", error);
    }
  }

  SleepTimer.stop();

  const session = useSession.getState().session;
  if (session) {
    syncPlaythroughs(session);
  }
}

/**
 * Load a playthrough into TrackPlayer.
 */
async function loadPlaythroughIntoPlayer(
  session: Session,
  playthrough: ActivePlaythrough,
): Promise<TrackLoadResult> {
  console.debug("[Loader] Loading playthrough into player...");

  const position = playthrough.stateCache?.currentPosition ?? 0;
  const playbackRate = playthrough.stateCache?.currentRate ?? 1;

  let streaming: boolean;

  await Player.reset();
  if (playthrough.media.download?.status === "ready") {
    // the media is downloaded, load the local file
    streaming = false;
    await Player.add({
      url: documentDirectoryFilePath(playthrough.media.download.filePath),
      pitchAlgorithm: PitchAlgorithm.Voice,
      duration: playthrough.media.duration
        ? parseFloat(playthrough.media.duration)
        : undefined,
      title: playthrough.media.book.title,
      artist: playthrough.media.book.bookAuthors
        .map((bookAuthor) => bookAuthor.author.name)
        .join(", "),
      artwork: playthrough.media.download.thumbnails
        ? documentDirectoryFilePath(
            playthrough.media.download.thumbnails.extraLarge,
          )
        : undefined,
      description: playthrough.id,
    });
  } else {
    // the media is not downloaded, load the stream
    streaming = true;
    await Player.add({
      url:
        Platform.OS === "ios"
          ? `${session.url}${playthrough.media.hlsPath}`
          : `${session.url}${playthrough.media.mpdPath}`,
      type: TrackType.Dash,
      pitchAlgorithm: PitchAlgorithm.Voice,
      duration: playthrough.media.duration
        ? parseFloat(playthrough.media.duration)
        : undefined,
      title: playthrough.media.book.title,
      artist: playthrough.media.book.bookAuthors
        .map((bookAuthor) => bookAuthor.author.name)
        .join(", "),
      artwork: playthrough.media.thumbnails
        ? `${session.url}/${playthrough.media.thumbnails.extraLarge}`
        : undefined,
      description: playthrough.id,
      headers: { Authorization: `Bearer ${session.token}` },
    });
  }

  await Player.seekTo(position);
  await setRate(playbackRate);
  await setPlayerOptions();

  // Wait for TrackPlayer to report the correct position after seek
  // This is important because seekTo() can return before the seek completes,
  // and downstream code (event recording, UI) needs the real position
  const actualPosition = await waitForSeekToComplete(position);

  return {
    playthroughId: playthrough.id,
    mediaId: playthrough.media.id,
    duration: parseFloat(playthrough.media.duration || "0"),
    position: actualPosition,
    playbackRate,
    chapters: playthrough.media.chapters,
    streaming,
  };
}

async function setPlayerOptions() {
  await Player.updateOptions({
    android: {
      alwaysPauseOnInterruption: true,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpBackward,
      Capability.JumpForward,
    ],
    forwardJumpInterval: 10,
    backwardJumpInterval: 10,
    progressUpdateEventInterval: 1,
  });
}
