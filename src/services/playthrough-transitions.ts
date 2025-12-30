/**
 * Centralized playthrough transition management.
 *
 * This service handles all playthrough transitions:
 * - Loading and playing media (with automatic pause of current)
 * - Resuming previous playthroughs
 * - Starting fresh playthroughs
 * - Finishing playthroughs (marking complete)
 * - Abandoning playthroughs
 *
 * All transitions that involve switching media handle pause internally,
 * so callers don't need to remember to pause first.
 *
 * UI components should use these functions for playthrough transitions.
 * The player store (player.ts) handles low-level playback controls
 * (play, pause, seek) and UI state (prompts, expansion).
 */

import { Platform } from "react-native";

import { PAUSE_REWIND_SECONDS } from "@/constants";
import {
  type ActivePlaythrough,
  clearActivePlaythroughIdForDevice,
  createPlaythrough,
  getActivePlaythroughIdForDevice,
  getInProgressPlaythrough,
  getPlaythroughById,
  resumePlaythrough as resumePlaythroughInDb,
  setActivePlaythroughIdForDevice,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { Session } from "@/stores/session";
import { documentDirectoryFilePath } from "@/utils";

import {
  initializePlaythroughTracking,
  pauseAndRecordEvent,
  recordResumeEvent,
  recordStartEvent,
} from "./event-recording-service";
import * as Coordinator from "./playback-coordinator";
import * as Lifecycle from "./playthrough-lifecycle";
import * as Player from "./trackplayer-wrapper";
import { PitchAlgorithm, TrackType } from "./trackplayer-wrapper";

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
// High-Level Transitions
// =============================================================================

/**
 * Load media and start playing.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Gets or creates an active playthrough for the media
 * 3. Loads the playthrough into TrackPlayer
 * 4. Starts playing and records play event
 * 5. Bumps data version to notify UI
 *
 * Returns the TrackLoadResult for the caller to update player state.
 *
 * Use this when the user taps play on a media item (after prompt checks).
 */
export async function loadAndPlayMedia(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  const result = await loadMediaIntoPlayer(session, mediaId);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, result.playthroughId);

  await playAndNotify();
  bumpPlaythroughDataVersion();

  return result;
}

/**
 * Resume a previous playthrough and start playing.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Marks the playthrough as in_progress in the database
 * 3. Loads the playthrough into TrackPlayer
 * 4. Starts playing and records play event
 * 5. Bumps data version to notify UI
 *
 * Returns the TrackLoadResult for the caller to update player state.
 *
 * Use this when the user chooses to resume a finished/abandoned playthrough.
 */
export async function resumePlaythroughAndPlay(
  session: Session,
  playthroughId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  // Mark as in_progress in database and record resume event
  await resumePlaythroughInDb(session, playthroughId);
  await recordResumeEvent(playthroughId);
  bumpPlaythroughDataVersion();

  // Get the now-active playthrough by ID
  const playthrough = await getPlaythroughById(session, playthroughId);
  if (!playthrough) {
    throw new Error(`Playthrough not found after resume: ${playthroughId}`);
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  await playAndNotify();

  return result;
}

/**
 * Create a new playthrough and start playing from the beginning.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Creates a new playthrough in the database
 * 3. Records start event
 * 4. Loads the playthrough into TrackPlayer
 * 5. Starts playing and records play event
 * 6. Bumps data version to notify UI
 *
 * Returns the TrackLoadResult for the caller to update player state.
 *
 * Use this when the user chooses "Start Fresh" on a media item.
 */
export async function startFreshAndPlay(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  await pauseCurrentIfPlaying();

  // Create new playthrough
  const playthroughId = await createPlaythrough(session, mediaId);
  await recordStartEvent(playthroughId);
  bumpPlaythroughDataVersion();

  // Get the new playthrough by ID
  const playthrough = await getPlaythroughById(session, playthroughId);
  if (!playthrough) {
    throw new Error(`Playthrough not found after create: ${playthroughId}`);
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);

  // Track this as the active playthrough for this device
  await setActivePlaythroughIdForDevice(session, playthroughId);

  await playAndNotify();

  return result;
}

/**
 * Mark a playthrough as finished.
 *
 * Handles pause and delegates to lifecycle service:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Delegates to lifecycle service for finish bookkeeping
 *
 * Caller is responsible for unloading the player if needed.
 */
export async function finishPlaythrough(
  session: Session,
  playthroughId: string,
  isLoaded: boolean,
): Promise<void> {
  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoaded) {
    await pauseAndRecordEvent();
  }

  // Delegate to lifecycle service for finish bookkeeping
  await Lifecycle.finishPlaythrough(session, playthroughId);
}

/**
 * Mark a playthrough as abandoned.
 *
 * Handles pause and delegates to lifecycle service:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Delegates to lifecycle service for abandon bookkeeping
 *
 * Caller is responsible for unloading the player if needed.
 */
export async function abandonPlaythrough(
  session: Session,
  playthroughId: string,
  isLoaded: boolean,
): Promise<void> {
  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoaded) {
    await pauseAndRecordEvent();
  }

  // Delegate to lifecycle service for abandon bookkeeping
  await Lifecycle.abandonPlaythrough(session, playthroughId);
}

/**
 * Clear the active playthrough for this device.
 *
 * This is for user-initiated "unload player" actions (e.g., from context menu).
 * Unlike logout/session expiry (which preserves the active playthrough ID for
 * next login), this clears it so the player stays unloaded on next app boot.
 *
 * Caller is responsible for actually unloading the player.
 */
export async function clearActivePlaythrough(session: Session): Promise<void> {
  await clearActivePlaythroughIdForDevice(session);
}

// =============================================================================
// Low-Level Loading (for special cases like downloads.ts and initialization)
// =============================================================================

/**
 * Load media into TrackPlayer without pausing current or starting playback.
 *
 * This is a low-level function for special cases:
 * - Reloading current media after download completes (downloads.ts)
 * - Initial load on app boot (player.ts initializePlayer)
 *
 * For normal "play this media" use cases, use loadAndPlayMedia instead.
 */
export async function loadMediaIntoPlayer(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  console.debug("[Transitions] Loading media into player", mediaId);

  // Check for active (in_progress) playthrough
  let playthrough = await getInProgressPlaythrough(session, mediaId);

  if (playthrough) {
    console.debug(
      "[Transitions] Found active playthrough:",
      playthrough.id,
      "position:",
      playthrough.stateCache?.currentPosition ?? 0,
    );
    return loadPlaythroughIntoPlayer(session, playthrough);
  }

  // No active playthrough - create a new one
  // Note: finished/abandoned playthroughs are handled by checkForResumePrompt
  // before this function is called
  console.debug("[Transitions] No active playthrough found; creating new one");

  const playthroughId = await createPlaythrough(session, mediaId);
  await recordStartEvent(playthroughId);
  bumpPlaythroughDataVersion();

  // Get the new playthrough by ID
  const newPlaythrough = await getPlaythroughById(session, playthroughId);

  if (!newPlaythrough) {
    throw new Error("Failed to create playthrough");
  }

  return loadPlaythroughIntoPlayer(session, newPlaythrough);
}

/**
 * Reload a specific playthrough by ID.
 *
 * This is used when we need to reload the currently loaded playthrough,
 * such as when switching between streaming and downloaded audio.
 *
 * Unlike loadMediaIntoPlayer which may create a new playthrough, this
 * explicitly loads a known playthrough ID.
 */
export async function reloadPlaythroughById(
  session: Session,
  playthroughId: string,
): Promise<TrackLoadResult> {
  console.debug("[Transitions] Reloading playthrough by ID:", playthroughId);

  const playthrough = await getPlaythroughById(session, playthroughId);

  if (!playthrough) {
    throw new Error(`Playthrough not found: ${playthroughId}`);
  }

  return loadPlaythroughIntoPlayer(session, playthrough);
}

/**
 * Load the stored active playthrough into Player.
 *
 * Used during app initialization to restore the last playing media.
 * Returns null if no active playthrough is stored for this device.
 *
 * Note: This function does NOT fall back to "most recently listened" if no
 * playthrough is stored. If the stored playthrough is invalid (deleted, finished,
 * abandoned), it clears the stored ID and returns null.
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
    const progress = await Player.getProgress();
    const position = progress.position;
    const duration = progress.duration;
    const playbackRate = await Player.getRate();

    // Get playthrough with full media info
    const playthrough = await getPlaythroughById(session, playthroughId);

    if (!playthrough) {
      console.warn(
        "[Transitions] Track loaded but playthrough not found:",
        playthroughId,
      );
      return null;
    }

    // Initialize playthrough tracking for event recording
    initializePlaythroughTracking(playthroughId, position, playbackRate);

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
    console.debug("[Transitions] No active playthrough stored for this device");
    return null;
  }

  // Verify the stored playthrough exists and is in_progress
  const playthrough = await getPlaythroughById(session, storedPlaythroughId);

  if (!playthrough) {
    console.debug(
      "[Transitions] Stored playthrough not found, clearing:",
      storedPlaythroughId,
    );
    await clearActivePlaythroughIdForDevice(session);
    return null;
  }

  if (playthrough.status !== "in_progress") {
    console.debug(
      "[Transitions] Stored playthrough is not in_progress (status:",
      playthrough.status,
      "), clearing:",
      storedPlaythroughId,
    );
    await clearActivePlaythroughIdForDevice(session);
    return null;
  }

  console.debug(
    "[Transitions] Loading stored active playthrough:",
    playthrough.id,
    "mediaId:",
    playthrough.media.id,
  );

  return loadPlaythroughIntoPlayer(session, playthrough);
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
    const { position } = await Player.getProgress();

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
  const { position } = await Player.getProgress();
  console.warn(
    "[Transitions] waitForSeekToComplete timed out. Expected:",
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
  const { playing } = await Player.isPlaying();
  if (!playing) return;

  console.debug("[Transitions] Pausing current playback before transition");
  await Player.pause();

  // Rewind slightly so the user has context when they resume
  // (see PAUSE_REWIND_SECONDS in constants.ts for explanation)
  const { position, duration } = await Player.getProgress();
  const playbackRate = await Player.getRate();
  let seekPosition = position - PAUSE_REWIND_SECONDS * playbackRate;
  seekPosition = Math.max(0, Math.min(seekPosition, duration));
  await Player.seekTo(seekPosition);

  // Notify coordinator to record pause event
  Coordinator.onPause();
}

/**
 * Start playback and notify coordinator.
 */
async function playAndNotify() {
  await Player.play();
  Coordinator.onPlay();
}

/**
 * Load a playthrough into Player.
 */
async function loadPlaythroughIntoPlayer(
  session: Session,
  playthrough: ActivePlaythrough,
): Promise<TrackLoadResult> {
  console.debug("[Transitions] Loading playthrough into player...");

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
  await Player.setRate(playbackRate);

  // Wait for TrackPlayer to report the correct position after seek
  // This is important because seekTo() can return before the seek completes,
  // and downstream code (event recording, UI) needs the real position
  const actualPosition = await waitForSeekToComplete(position);

  // Initialize playthrough tracking for event recording
  initializePlaythroughTracking(playthrough.id, actualPosition, playbackRate);

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
