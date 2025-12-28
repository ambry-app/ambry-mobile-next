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
import TrackPlayer, {
  isPlaying,
  PitchAlgorithm,
  TrackType,
} from "react-native-track-player";

import { PAUSE_REWIND_SECONDS } from "@/constants";
import {
  ActivePlaythrough,
  createPlaythrough,
  getActivePlaythrough,
  getMostRecentInProgressPlaythrough,
  resumePlaythrough as resumePlaythroughInDb,
  updatePlaythroughStatus,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { documentDirectoryFilePath } from "@/utils";

import {
  getCurrentPlaythroughId,
  initializePlaythroughTracking,
  pauseAndRecordEvent,
  recordAbandonEvent,
  recordFinishEvent,
  recordStartEvent,
} from "./event-recording-service";
import * as Coordinator from "./playback-coordinator";

// =============================================================================
// Types
// =============================================================================

export interface TrackLoadResult {
  mediaId: string;
  duration: number;
  position: number;
  playbackRate: number;
  streaming: boolean;
  chapters: schema.Chapter[];
}

export type FinishOptions = {
  /** Skip unloading the player (e.g., when loading new media immediately after) */
  skipUnload?: boolean;
};

// =============================================================================
// Callback for unloading player (breaks circular dependency with player.ts)
// =============================================================================

let unloadPlayerCallback: (() => Promise<void>) | null = null;

export function setUnloadPlayerCallback(
  callback: (() => Promise<void>) | null,
) {
  unloadPlayerCallback = callback;
}

// =============================================================================
// High-Level Transitions (include pause, load, play, and state updates)
// =============================================================================

/**
 * Load media and start playing.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Gets or creates an active playthrough for the media
 * 3. Loads the playthrough into TrackPlayer
 * 4. Updates player store state
 * 5. Starts playing and records play event
 * 6. Bumps data version to notify UI
 *
 * Use this when the user taps play on a media item (after prompt checks).
 */
export async function loadAndPlayMedia(session: Session, mediaId: string) {
  await pauseCurrentIfPlaying();

  const result = await loadMediaIntoPlayer(session, mediaId);
  updatePlayerStoreFromLoadResult(result);

  await playAndNotify();
  bumpPlaythroughDataVersion();
}

/**
 * Resume a previous playthrough and start playing.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Marks the playthrough as in_progress in the database
 * 3. Loads the playthrough into TrackPlayer
 * 4. Updates player store state
 * 5. Starts playing and records play event
 * 6. Bumps data version to notify UI
 *
 * Use this when the user chooses to resume a finished/abandoned playthrough.
 */
export async function resumePlaythroughAndPlay(
  session: Session,
  playthroughId: string,
  mediaId: string,
) {
  await pauseCurrentIfPlaying();

  // Mark as in_progress in database
  await resumePlaythroughInDb(session, playthroughId);
  bumpPlaythroughDataVersion();

  // Load the now-active playthrough
  const playthrough = await getActivePlaythrough(session, mediaId);
  if (!playthrough) {
    console.error(
      "[Transitions] No active playthrough found after resume for media:",
      mediaId,
    );
    usePlayer.setState({ loadingNewMedia: false });
    return;
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);
  updatePlayerStoreFromLoadResult(result);

  await playAndNotify();
}

/**
 * Create a new playthrough and start playing from the beginning.
 *
 * Handles the complete transition:
 * 1. Pauses current playback (if any) and records pause event
 * 2. Creates a new playthrough in the database
 * 3. Records start event
 * 4. Loads the playthrough into TrackPlayer
 * 5. Updates player store state
 * 6. Starts playing and records play event
 * 7. Bumps data version to notify UI
 *
 * Use this when the user chooses "Start Fresh" on a media item.
 */
export async function startFreshAndPlay(session: Session, mediaId: string) {
  await pauseCurrentIfPlaying();

  // Create new playthrough
  const playthroughId = await createPlaythrough(session, mediaId);
  await recordStartEvent(playthroughId);
  bumpPlaythroughDataVersion();

  // Load the new playthrough
  const playthrough = await getActivePlaythrough(session, mediaId);
  if (!playthrough) {
    console.error(
      "[Transitions] No active playthrough found after create for media:",
      mediaId,
    );
    usePlayer.setState({ loadingNewMedia: false });
    return;
  }

  const result = await loadPlaythroughIntoPlayer(session, playthrough);
  updatePlayerStoreFromLoadResult(result);

  await playAndNotify();
}

/**
 * Mark a playthrough as finished.
 *
 * Handles all coordination:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Records "finish" lifecycle event
 * 3. Updates playthrough status in database
 * 4. Bumps data version to notify UI
 * 5. Unloads player if this playthrough was loaded (unless skipUnload is true)
 */
export async function finishPlaythrough(
  session: Session,
  playthroughId: string,
  options?: FinishOptions,
) {
  const isLoadedInPlayer = getCurrentPlaythroughId() === playthroughId;

  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoadedInPlayer) {
    await pauseAndRecordEvent();
  }

  // Record the finish lifecycle event
  await recordFinishEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(session, playthroughId, "finished", {
    finishedAt: new Date(),
  });

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Unload player if this playthrough was loaded (unless caller wants to handle it)
  if (isLoadedInPlayer && !options?.skipUnload) {
    await unloadPlayerCallback?.();
  }
}

/**
 * Mark a playthrough as abandoned.
 *
 * Handles all coordination:
 * 1. If this playthrough is loaded in player and playing, pauses and records pause event
 * 2. Records "abandon" lifecycle event
 * 3. Updates playthrough status in database
 * 4. Bumps data version to notify UI
 * 5. Unloads player if this playthrough was loaded
 */
export async function abandonPlaythrough(
  session: Session,
  playthroughId: string,
) {
  const isLoadedInPlayer = getCurrentPlaythroughId() === playthroughId;

  // If this playthrough is loaded, pause if playing and record the event
  // (pauseAndRecordEvent checks isPlaying internally, skips if already paused)
  if (isLoadedInPlayer) {
    await pauseAndRecordEvent();
  }

  // Record the abandon lifecycle event
  await recordAbandonEvent(playthroughId);

  // Update status in database
  await updatePlaythroughStatus(session, playthroughId, "abandoned", {
    abandonedAt: new Date(),
  });

  // Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  // Unload player if this playthrough was loaded
  if (isLoadedInPlayer) {
    await unloadPlayerCallback?.();
  }
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
  let playthrough = await getActivePlaythrough(session, mediaId);

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

  playthrough = await getActivePlaythrough(session, mediaId);

  if (!playthrough) {
    throw new Error("Failed to create playthrough");
  }

  return loadPlaythroughIntoPlayer(session, playthrough);
}

/**
 * Load the most recent in-progress playthrough into TrackPlayer.
 *
 * Used during app initialization to restore the last playing media.
 * Returns null if no in-progress playthrough exists.
 */
export async function loadMostRecentIntoPlayer(
  session: Session,
): Promise<TrackLoadResult | null> {
  const track = await TrackPlayer.getTrack(0);

  if (track) {
    // Track already loaded (e.g., from headless context or previous session)
    // Still need to initialize playthrough tracking
    const streaming = track.url.startsWith("http");
    const mediaId = track.description!;
    const progress = await TrackPlayer.getProgress();
    const position = progress.position;
    const duration = progress.duration;
    const playbackRate = await TrackPlayer.getRate();

    // Get playthrough for chapters
    const playthrough = await getActivePlaythrough(session, mediaId);

    // Initialize playthrough tracking for event recording
    await initializePlaythroughTracking(
      session,
      mediaId,
      position,
      playbackRate,
    );

    return {
      mediaId,
      position,
      duration,
      playbackRate,
      streaming,
      chapters: playthrough?.media.chapters || [],
    };
  }

  // Find most recent in-progress playthrough
  const mostRecentPlaythrough =
    await getMostRecentInProgressPlaythrough(session);

  if (!mostRecentPlaythrough) {
    console.debug("[Transitions] No in-progress playthrough found");
    return null;
  }

  console.debug(
    "[Transitions] Loading most recent playthrough:",
    mostRecentPlaythrough.id,
    "mediaId:",
    mostRecentPlaythrough.media.id,
  );

  return loadPlaythroughIntoPlayer(session, mostRecentPlaythrough);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Pause current playback if playing and record the pause event.
 * No-op if nothing is playing.
 */
async function pauseCurrentIfPlaying() {
  const { playing } = await isPlaying();
  if (!playing) return;

  console.debug("[Transitions] Pausing current playback before transition");
  await TrackPlayer.pause();

  // Rewind slightly so the user has context when they resume
  // (see PAUSE_REWIND_SECONDS in constants.ts for explanation)
  const { position, duration } = await TrackPlayer.getProgress();
  const playbackRate = await TrackPlayer.getRate();
  let seekPosition = position - PAUSE_REWIND_SECONDS * playbackRate;
  seekPosition = Math.max(0, Math.min(seekPosition, duration));
  await TrackPlayer.seekTo(seekPosition);

  // Notify coordinator to record pause event
  Coordinator.onPause();
}

/**
 * Start playback and notify coordinator.
 */
async function playAndNotify() {
  await TrackPlayer.play();
  Coordinator.onPlay();
}

/**
 * Update the player store with the result of loading a track.
 */
function updatePlayerStoreFromLoadResult(result: TrackLoadResult) {
  const { chapters, position, duration } = result;

  // Calculate initial chapter state
  const currentChapter = chapters.find(
    (chapter) => position < (chapter.endTime || duration),
  );
  const previousChapterStartTime = currentChapter
    ? chapters[chapters.indexOf(currentChapter) - 1]?.startTime || 0
    : 0;

  usePlayer.setState({
    loadingNewMedia: false,
    mediaId: result.mediaId,
    duration: result.duration,
    position: result.position,
    playbackRate: result.playbackRate,
    streaming: result.streaming,
    chapters,
    currentChapter,
    previousChapterStartTime,
  });
}

/**
 * Load a playthrough into TrackPlayer.
 */
async function loadPlaythroughIntoPlayer(
  session: Session,
  playthrough: ActivePlaythrough,
): Promise<TrackLoadResult> {
  console.debug("[Transitions] Loading playthrough into player...");

  const position = playthrough.stateCache?.currentPosition ?? 0;
  const playbackRate = playthrough.stateCache?.currentRate ?? 1;

  let streaming: boolean;

  await TrackPlayer.reset();
  if (playthrough.media.download?.status === "ready") {
    // the media is downloaded, load the local file
    streaming = false;
    await TrackPlayer.add({
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
      description: playthrough.media.id,
    });
  } else {
    // the media is not downloaded, load the stream
    streaming = true;
    await TrackPlayer.add({
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
      description: playthrough.media.id,
      headers: { Authorization: `Bearer ${session.token}` },
    });
  }

  await TrackPlayer.seekTo(position);
  await TrackPlayer.setRate(playbackRate);

  // Initialize playthrough tracking for event recording
  await initializePlaythroughTracking(
    session,
    playthrough.media.id,
    position,
    playbackRate,
  );

  return {
    mediaId: playthrough.media.id,
    duration: parseFloat(playthrough.media.duration || "0"),
    position,
    playbackRate,
    chapters: playthrough.media.chapters,
    streaming,
  };
}
