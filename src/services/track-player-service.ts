/**
 * Track Player Service.
 *
 * This service provides a higher-level API for interacting with the Track
 * Player, managing playback state, progress tracking, and playthrough data. It
 * keeps the Zustand store in sync with the underlying Track Player and
 * database.
 */

import { Platform } from "react-native";

import { getPlaythrough, type PlaythroughWithMedia } from "@/db/playthroughs";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { useDataVersion } from "@/stores/data-version";
import {
  initialState,
  type ProgressWithPercent,
  useTrackPlayer,
} from "@/stores/track-player";
import { Chapter } from "@/types/db-schema";
import { type Session } from "@/types/session";
import {
  AddTrack,
  AndroidAudioContentType,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  State,
  TrackType,
} from "@/types/track-player";
import { documentDirectoryFilePath } from "@/utils";

import { TrackLoadResult } from "./playthrough-loader";
import { getSession } from "./session-service";

let progressCheckInterval: NodeJS.Timeout | null = null;

// =============================================================================
// Public API
// =============================================================================

export async function initialize() {
  if (isInitialized()) {
    console.debug("[TrackPlayer Service] Already initialized, skipping");
    return;
  }

  console.debug("[TrackPlayer Service] Initializing...");

  await setupPlayer();

  // playbackState
  TrackPlayer.getPlaybackState().then((playbackState) => {
    useTrackPlayer.setState({ playbackState });
    updateIsPlaying();
  });

  TrackPlayer.addEventListener(Event.PlaybackState, (state) => {
    useTrackPlayer.setState({ playbackState: state });
    updateIsPlaying();
  });

  // playWhenReady
  TrackPlayer.getPlayWhenReady().then((playWhenReady) => {
    useTrackPlayer.setState({ playWhenReady });
    updateIsPlaying();
  });

  TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (event) => {
    useTrackPlayer.setState({ playWhenReady: event.playWhenReady });
    updateIsPlaying();
  });

  // playthrough data version changes
  useDataVersion.subscribe((state, prevState) => {
    if (state.playthroughDataVersion === prevState.playthroughDataVersion)
      // no change
      return;

    const { playthrough } = useTrackPlayer.getState();
    // no playthrough to update
    if (!playthrough) return;

    updatePlaythrough(playthrough.id);
  });

  // Done
  useTrackPlayer.setState({ initialized: true });
  console.debug("[TrackPlayer Service] Initialized");
}

// Playback Control

// FIXME:
// not necessary: progress and other things are tracked reactively via listeners
export async function play() {
  console.debug("[TrackPlayer Service] play");
  return TrackPlayer.play();
}

// FIXME:
// not necessary: progress and other things are tracked reactively via listeners
export async function pause() {
  console.debug("[TrackPlayer Service] pause");
  return TrackPlayer.pause();
}

/**
 * Seek to a specific position in the track.
 *
 * This immediately updates the store's progress after seeking.
 */
export async function seekTo(position: number) {
  console.debug("[TrackPlayer Service] seekTo", position.toFixed(1));
  await TrackPlayer.seekTo(position);
  const progress = await waitForSeekToComplete(position);
  updateProgress(progress);
}

/**
 * Set the playback rate and update the store.
 */
export async function setPlaybackRate(rate: number) {
  console.debug("[TrackPlayer Service] setPlaybackRate", rate);
  await TrackPlayer.setRate(rate);
  const currentRate = await TrackPlayer.getRate();
  useTrackPlayer.setState({ playbackRate: currentRate });
}

// State Queries

export function getLoadedPlaythrough() {
  console.debug("[TrackPlayer Service] getPlaythrough");
  const { playthrough } = useTrackPlayer.getState();
  return playthrough;
}

// TODO: Audit usage of `getAccurateProgress` to
// see if we can replace with this.
/**
 * Get progress from the store.
 *
 * This is only updated every second while playing. For accurate progress, use
 * `getAccurateProgress` instead.
 */
export function getProgress() {
  console.debug("[TrackPlayer Service] getProgress");
  const { progress } = useTrackPlayer.getState();
  return progress;
}

/**
 * Get progress directly from Track Player, waiting for accurate duration.
 *
 * This bypasses the store to ensure we get the most up-to-date progress.
 */
export async function getAccurateProgress() {
  console.debug("[TrackPlayer Service] getAccurateProgress");
  return getProgressWithPercent();
}

/**
 * Get the current chapter from the store.
 */
export function getCurrentChapter() {
  console.debug("[TrackPlayer Service] getCurrentChapter");
  const { currentChapter } = useTrackPlayer.getState();
  return currentChapter;
}

/**
 * Get the previous chapter from the store.
 */
export function getPreviousChapter() {
  console.debug("[TrackPlayer Service] getPreviousChapter");
  const { previousChapter } = useTrackPlayer.getState();
  return previousChapter;
}

/**
 * Get the current playback rate from the store.
 */
export function getPlaybackRate() {
  console.debug("[TrackPlayer Service] getPlaybackRate");
  const { playbackRate } = useTrackPlayer.getState();
  return playbackRate;
}

/**
 * Get isPlaying state from the store.
 */
export function isPlaying() {
  console.debug("[TrackPlayer Service] isPlaying");
  const { isPlaying } = useTrackPlayer.getState();
  return isPlaying;
}

// Playthrough Management

/**
 * Load a playthrough into TrackPlayer.
 */
export async function loadPlaythroughIntoPlayer(
  session: Session,
  playthrough: PlaythroughWithMedia,
): Promise<TrackLoadResult> {
  console.debug("[TrackPlayer Service] Loading playthrough into player...");

  const streaming = playthrough.media.download?.status !== "ready";
  const position = playthrough.stateCache?.currentPosition ?? 0;
  const playbackRate = playthrough.stateCache?.currentRate ?? 1;
  const trackAdd = buildAddTrack(session, playthrough);

  await TrackPlayer.reset();
  await TrackPlayer.add(trackAdd);
  await TrackPlayer.seekTo(position);
  await TrackPlayer.setRate(playbackRate);
  await setPlayerOptions();

  const progress = await waitForSeekToComplete(position);
  const actualPlaybackRate = await TrackPlayer.getRate();

  useTrackPlayer.setState({
    ...initialState,
    playbackRate: actualPlaybackRate,
    progress,
    streaming,
    playthrough: {
      id: playthrough.id,
      mediaId: playthrough.mediaId,
      status: playthrough.status,
    },
    ...buildInitialChapterState(playthrough.media.chapters, progress),
  });

  // FIXME: for now we continue to return this so player-ui-state works. But
  // eventually the track-player store should become the authority on these
  // values.
  return {
    playthroughId: playthrough.id,
    mediaId: playthrough.media.id,
    duration: progress.duration,
    position: progress.position,
    playbackRate: actualPlaybackRate,
    chapters: playthrough.media.chapters,
  };
}

/**
 * Unloads the current playthrough from TrackPlayer and resets state.
 */
export async function unload() {
  console.debug("[TrackPlayer Service] unload");
  useTrackPlayer.setState(initialState);
  return TrackPlayer.reset();
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Check if the Track Player store is initialized.
 */
function isInitialized() {
  return useTrackPlayer.getState().initialized;
}

async function setupPlayer() {
  try {
    await TrackPlayer.setupPlayer({
      androidAudioContentType: AndroidAudioContentType.Speech,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
      autoHandleInterruptions: true,
    });
  } catch (error) {
    console.error("[TrackPlayer Service] setupPlayer failed", error);
    return;
  }

  console.debug("[TrackPlayer Service] setupPlayer succeeded");
}

/**
 * Update progress in the store.
 */
async function updateProgress(progress: ProgressWithPercent) {
  useTrackPlayer.setState({ progress, ...buildNewChapterState(progress) });
}

/**
 * Update playthrough data from the DB.
 */
async function updatePlaythrough(playthroughId: string) {
  const session = getSession();

  const playthrough = await getPlaythrough(session, playthroughId);

  useTrackPlayer.setState({
    playthrough: {
      id: playthrough.id,
      mediaId: playthrough.mediaId,
      status: playthrough.status,
    },
  });
}

/**
 * Update isPlaying state based on playWhenReady and playbackState.
 *
 * Also starts/stops progress tracking as needed.
 */
function updateIsPlaying() {
  const { playWhenReady, playbackState } = useTrackPlayer.getState();
  const isPlaying = determineIsPlaying(playWhenReady, playbackState.state);
  useTrackPlayer.setState({ isPlaying });

  if (isPlaying.playing) {
    startTrackingProgress();
  } else {
    stopTrackingProgress();
  }
}

/**
 * Determine isPlaying state from playWhenReady and playback state.
 *
 * copied from: node_modules/react-native-track-player/src/hooks/useIsPlaying.ts
 */
function determineIsPlaying(playWhenReady: boolean, state: State) {
  const isLoading = state === State.Loading || state === State.Buffering;
  const isErrored = state === State.Error;
  const isEnded = state === State.Ended;
  const isNone = state === State.None;

  return {
    playing: playWhenReady && !(isErrored || isEnded || isNone),
    bufferingDuringPlay: playWhenReady && isLoading,
  };
}

/**
 * Get progress with percent complete.
 */
async function getProgressWithPercent(): Promise<ProgressWithPercent> {
  const progress = await getProgressWaitForDuration();
  const progressPercent =
    progress.duration > 0 ? (progress.position / progress.duration) * 100 : 0;

  return {
    ...progress,
    percent: progressPercent,
  };
}

/**
 * Get progress, waiting up to timeoutMs for a valid duration (> 0).
 */
async function getProgressWaitForDuration(timeoutMs: number = 2000) {
  const startTime = Date.now();
  const pollIntervalMs = 50;

  while (Date.now() - startTime < timeoutMs) {
    const progress = await TrackPlayer.getProgress();

    if (progress.duration > 0) {
      return progress;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout reached without getting a valid duration
  console.warn(
    "[TrackPlayer Service] getProgressWaitForDuration: Timeout reached while waiting for valid duration",
  );
  const progress = await TrackPlayer.getProgress();
  return progress;
}

/**
 * Start updating progress every second.
 */
function startTrackingProgress() {
  if (progressCheckInterval) return;

  progressCheckInterval = setInterval(async () => {
    const progress = await getAccurateProgress();
    updateProgress(progress);
  }, 1000);
}

/**
 * Stop updating progress.
 */
function stopTrackingProgress() {
  if (!progressCheckInterval) return;

  clearInterval(progressCheckInterval);
  progressCheckInterval = null;
}

/**
 * Build AddTrack options for a playthrough.
 */
function buildAddTrack(
  session: Session,
  playthrough: PlaythroughWithMedia,
): AddTrack {
  const streamOptions =
    playthrough.media.download?.status === "ready"
      ? buildDownloadedTrackAdd(playthrough)
      : buildStreamingTrackAdd(session, playthrough);

  return {
    ...streamOptions,
    pitchAlgorithm: PitchAlgorithm.Voice,
    duration: playthrough.media.duration
      ? parseFloat(playthrough.media.duration)
      : undefined,
    title: playthrough.media.book.title,
    artist: playthrough.media.book.bookAuthors
      .map((bookAuthor) => bookAuthor.author.name)
      .join(", "),
    description: playthrough.id,
  };
}

function buildDownloadedTrackAdd(playthrough: PlaythroughWithMedia) {
  return {
    url: documentDirectoryFilePath(playthrough.media.download!.filePath),
    artwork: playthrough.media.download!.thumbnails
      ? documentDirectoryFilePath(
          playthrough.media.download!.thumbnails.extraLarge,
        )
      : undefined,
  };
}

function buildStreamingTrackAdd(
  session: Session,
  playthrough: PlaythroughWithMedia,
) {
  return {
    url:
      Platform.OS === "ios"
        ? `${session.url}${playthrough.media.hlsPath}`
        : `${session.url}${playthrough.media.mpdPath}`,
    type: TrackType.Dash,
    artwork: playthrough.media.thumbnails
      ? `${session.url}/${playthrough.media.thumbnails.extraLarge}`
      : undefined,
    headers: { Authorization: `Bearer ${session.token}` },
  };
}

function buildInitialChapterState(
  chapters: Chapter[],
  progress: ProgressWithPercent,
) {
  return {
    chapters,
    ...getCurrentAndPreviousChapter(chapters, progress),
  };
}

function buildNewChapterState(progress: ProgressWithPercent) {
  const { chapters, currentChapter } = useTrackPlayer.getState();

  if (
    currentChapter &&
    (progress.position < currentChapter.startTime ||
      (currentChapter.endTime && progress.position >= currentChapter.endTime))
  ) {
    return getCurrentAndPreviousChapter(chapters, progress);
  } else {
    return {};
  }
}

function getCurrentAndPreviousChapter(
  chapters: Chapter[],
  progress: ProgressWithPercent,
) {
  if (chapters.length === 0) {
    return { currentChapter: null, previousChapter: null };
  }

  let currentChapter: Chapter | null = null;
  let previousChapter: Chapter | null = null;

  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index]!;
    if (progress.position < (chapter.endTime || progress.duration)) {
      currentChapter = chapter;
      previousChapter = index > 0 ? chapters[index - 1]! : null;
      break;
    }
  }

  return { currentChapter, previousChapter };
}

/**
 * Set player options.
 */
async function setPlayerOptions() {
  await TrackPlayer.updateOptions({
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

/**
 * Wait for TrackPlayer to report a position close to the expected position.
 * This is needed because seekTo() can return before the seek actually completes,
 * especially for streaming content.
 *
 * @param expectedPosition - The position we seeked to
 * @param timeoutMs - Maximum time to wait (default 500ms)
 * @param toleranceSeconds - How close is "close enough" (default 1 second)
 * @returns The actual position reported by TrackPlayer
 */
async function waitForSeekToComplete(
  expectedPosition: number,
  timeoutMs: number = 500,
  toleranceSeconds: number = 1,
) {
  const startTime = Date.now();
  const pollIntervalMs = 10;

  while (Date.now() - startTime < timeoutMs) {
    const progress = await getAccurateProgress();

    // Check if position is close enough to expected
    const diff = Math.abs(progress.position - expectedPosition);
    if (diff <= toleranceSeconds) {
      return progress;
    } else {
      console.debug(
        "[TrackPlayer Service] waitForSeekToComplete: diff:",
        diff.toFixed(2),
        "Expected:",
        expectedPosition.toFixed(2),
        "Got:",
        progress.position.toFixed(2),
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - return whatever position we have
  const progress = await getAccurateProgress();
  console.warn(
    "[TrackPlayer Service] waitForSeekToComplete timed out. Expected:",
    expectedPosition.toFixed(2),
    "Got:",
    progress.position.toFixed(2),
  );
  return progress;
}

// Debug: Log state changes
// useTrackPlayer.subscribe((state) => {
//   console.debug(
//     "[TrackPlayer Store] State changed:",
//     JSON.stringify(state, null, 2),
//   );
// });
