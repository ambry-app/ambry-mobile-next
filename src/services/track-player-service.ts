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
  PlayPauseSource,
  type PlayPauseSourceType,
  PlayPauseType,
  type ProgressWithPercent,
  SeekSource,
  type SeekSourceType,
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
import { logBase } from "@/utils/logger";
import { documentDirectoryFilePath } from "@/utils/paths";
import { subscribeToChange } from "@/utils/subscribe";

import { getSession } from "./session-service";

const log = logBase.extend("track-player-service");

const PROGRESS_UPDATE_INTERVAL = 1000;

type PlayPauseDirection = "play" | "pause";

let progressCheckInterval: NodeJS.Timeout | null = null;
let awaitingIsPlayingMatch: PlayPauseDirection | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the Track Player service and store.
 */
export async function initialize() {
  if (isInitialized()) {
    log.debug("Already initialized, skipping");
    return;
  }

  await setupPlayer();
  setupTrackPlayerListeners();
  setupStoreSubscriptions();

  useTrackPlayer.setState({ initialized: true });
  log.debug("Initialized");
}

// Playback Control

/**
 * Start playback.
 */
export async function play(source: PlayPauseSourceType) {
  log.debug(`play (source: ${source})`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) {
    log.warn("play() called with no playthrough loaded");
    return;
  }

  const { position } = await getAccurateProgress();
  const timestamp = Date.now();

  awaitingIsPlayingMatch = "play";

  await TrackPlayer.play();

  emitPlayPauseEvent({
    direction: "play",
    source,
    timestamp,
    position,
    playbackRate,
    playthroughId: playthrough.id,
  });
}

/**
 * Pause playback.
 *
 * @param source - The source of the pause action
 * @param rewindSeconds - Optional seconds to rewind after pausing (multiplied by playback rate)
 */
export async function pause(
  source: PlayPauseSourceType,
  rewindSeconds?: number,
) {
  log.debug(`pause (source: ${source}, rewind: ${rewindSeconds ?? 0}s)`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) {
    log.warn("pause() called with no playthrough loaded");
    return;
  }

  const { position, duration } = await getAccurateProgress();
  const timestamp = Date.now();

  awaitingIsPlayingMatch = "pause";

  await TrackPlayer.pause();

  emitPlayPauseEvent({
    direction: "pause",
    source,
    timestamp,
    position,
    playbackRate,
    playthroughId: playthrough.id,
  });

  if (rewindSeconds) {
    const rewindAmount = rewindSeconds * playbackRate;
    const newPosition = Math.max(
      0,
      Math.min(position - rewindAmount, duration),
    );
    log.debug(
      `Rewinding from ${position.toFixed(1)} to ${newPosition.toFixed(1)}`,
    );
    await seekTo(newPosition, SeekSource.INTERNAL);
  }
}

/**
 * Pause playback if currently playing. No-op if not playing.
 *
 * @param source - The source of the pause action
 * @param rewindSeconds - Optional seconds to rewind after pausing (multiplied by playback rate)
 */
export async function pauseIfPlaying(
  source: PlayPauseSourceType,
  rewindSeconds?: number,
) {
  const { playing } = isPlaying();
  if (playing) {
    await pause(source, rewindSeconds);
  }
}

/**
 * Seek to a specific position in the track.
 *
 * This immediately updates the store's progress after seeking, and tracks the
 * seek event with captured playthrough context. Chapter state is also updated.
 */
export async function seekTo(position: number, source: SeekSourceType) {
  log.debug(`seekTo ${position.toFixed(1)}`);

  const { playthrough, playbackRate } = useTrackPlayer.getState();
  const timestamp = Date.now();

  const beforeProgress = getProgress();
  await TrackPlayer.seekTo(position);
  const progress = await waitForSeekToComplete(position);

  const lastSeek = playthrough
    ? {
        timestamp,
        source,
        playthroughId: playthrough.id,
        playbackRate,
        from: beforeProgress.position,
        to: progress.position,
      }
    : null;

  useTrackPlayer.setState({
    lastSeek,
    ...buildNewProgress(progress),
  });
}

/**
 * Set the playback rate and update the store.
 *
 * Emits a lastRateChange event with captured playthrough context.
 */
export async function setPlaybackRate(rate: number) {
  log.debug(`setPlaybackRate ${rate}`);

  const {
    playthrough,
    progress,
    playbackRate: previousRate,
  } = useTrackPlayer.getState();

  await TrackPlayer.setRate(rate);
  const currentRate = await TrackPlayer.getRate();

  const lastRateChange = playthrough
    ? {
        timestamp: Date.now(),
        playthroughId: playthrough.id,
        position: progress.position,
        previousRate,
        newRate: currentRate,
      }
    : null;

  useTrackPlayer.setState({ playbackRate: currentRate, lastRateChange });
}

// State Queries

/**
 * Get the currently loaded playthrough from the store.
 */
export function getLoadedPlaythrough() {
  log.debug("getPlaythrough");
  const { playthrough } = useTrackPlayer.getState();
  return playthrough;
}

/**
 * Get progress from the store.
 *
 * This is only updated every second while playing. For accurate progress, use
 * `getAccurateProgress` instead.
 */
export function getProgress() {
  log.silly("getProgress");
  const { progress } = useTrackPlayer.getState();
  return progress;
}

/**
 * Get progress directly from Track Player.
 *
 * This bypasses the store to ensure we get the most up-to-date progress.
 */
export async function getAccurateProgress() {
  log.silly("getAccurateProgress");
  return getProgressWithPercent();
}

/**
 * Get the current chapter from the store.
 */
export function getCurrentChapter() {
  log.debug("getCurrentChapter");
  const { currentChapter } = useTrackPlayer.getState();
  return currentChapter;
}

/**
 * Get the previous chapter from the store.
 */
export function getPreviousChapter() {
  log.debug("getPreviousChapter");
  const { previousChapter } = useTrackPlayer.getState();
  return previousChapter;
}

/**
 * Get the current playback rate from the store.
 */
export function getPlaybackRate() {
  log.debug("getPlaybackRate");
  const { playbackRate } = useTrackPlayer.getState();
  return playbackRate;
}

/**
 * Get isPlaying state from the store.
 */
export function isPlaying() {
  log.debug("isPlaying");
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
): Promise<void> {
  log.info(`Loading playthrough into player ${playthrough.id}`);

  awaitingIsPlayingMatch = null;

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
}

/**
 * Unloads the current playthrough from TrackPlayer and resets state.
 */
export async function unload() {
  log.debug("unload");
  awaitingIsPlayingMatch = null;
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

/**
 * Set up Track Player event listeners to keep the store in sync.
 */
function setupTrackPlayerListeners() {
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
}

/**
 * Subscribes to stores to keep data in sync.
 */
function setupStoreSubscriptions() {
  subscribeToChange(
    useDataVersion,
    (s) => s.playthroughDataVersion,
    () => {
      const session = getSession();
      const loadedPlaythrough = getLoadedPlaythrough();

      if (!loadedPlaythrough) return;

      updatePlaythrough(session, loadedPlaythrough.id);
    },
  );

  subscribeToChange(
    useTrackPlayer,
    (s) => s.isPlaying.playing,
    handleIsPlayingChanged,
  );
}

/**
 * Set up the Track Player with default options.
 */
async function setupPlayer() {
  try {
    await TrackPlayer.setupPlayer({
      androidAudioContentType: AndroidAudioContentType.Speech,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
      autoHandleInterruptions: true,
    });
  } catch (error) {
    log.error("setupPlayer failed", error);
    return;
  }

  log.debug("setupPlayer succeeded");
}

/**
 * Build new progress state.
 */
function buildNewProgress(progress: ProgressWithPercent) {
  return { progress, ...buildNewChapterState(progress) };
}

/**
 * Build initial chapter state based on chapters and progress.
 */
function buildInitialChapterState(
  chapters: Chapter[],
  progress: ProgressWithPercent,
) {
  return {
    chapters,
    ...getCurrentAndPreviousChapter(chapters, progress),
  };
}

/**
 * Build new chapter state based on progress.
 */
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

/**
 * Get the current and previous chapters based on progress.
 */
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
 * Update playthrough data from the DB.
 */
async function updatePlaythrough(session: Session, playthroughId: string) {
  const playthrough = await getPlaythrough(session, playthroughId);

  const currentPlaythrough = getLoadedPlaythrough();
  if (!currentPlaythrough || currentPlaythrough.id !== playthroughId) {
    log.debug(
      "updatePlaythrough: playthrough was unloaded during fetch, skipping update",
    );
    return;
  }

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
  log.warn(
    "getProgressWaitForDuration: Timeout reached while waiting for valid duration",
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
    useTrackPlayer.setState(buildNewProgress(progress));
  }, PROGRESS_UPDATE_INTERVAL);
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

/**
 * Build AddTrack for downloaded media.
 */
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

/**
 * Build AddTrack for streaming media.
 */
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
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - return whatever position we have
  const progress = await getAccurateProgress();
  log.warn(
    `waitForSeekToComplete timed out. Expected: ${expectedPosition.toFixed(2)} Got: ${progress.position.toFixed(2)}`,
  );
  return progress;
}

/**
 * Play/Pause Event Consolidation
 *
 * Produces canonical play/pause events by consolidating two signals: our
 * play()/pause() functions and the `isPlaying` state changes (from TrackPlayer).
 *
 * This consolidation is necessary because play/pause can be triggered
 * externally (e.g. system interruptions, like RemoteDuck or a user manually
 * starting playback in another app) without going through our command
 * functions, especially on Android where the `RemoteDuck` TrackPlayer event is
 * currently broken.
 *
 * Deduplication strategy:
 * - play()/pause() set `awaitingIsPlayingMatch` BEFORE calling TrackPlayer
 * - play()/pause() emit the event directly after calling TrackPlayer
 * - When isPlaying changes, if it matches `awaitingIsPlayingMatch`, we skip
 *   (it's the result of our own command)
 * - If it doesn't match (or we're not awaiting), it's an external event and
 *   we emit immediately
 *
 * Consumers should subscribe to `lastPlayPause` in the track-player store for
 * the authoritative play/pause events.
 */

/**
 * Handle isPlaying state changes.
 *
 * When isPlaying changes and matches what we're awaiting from a command, we skip
 * (it's the result of our own command). Otherwise, it's an external event and we
 * emit immediately.
 */
function handleIsPlayingChanged(isPlaying: boolean) {
  const { progress, playthrough, playbackRate } = useTrackPlayer.getState();
  const direction: PlayPauseDirection = isPlaying ? "play" : "pause";

  log.debug(
    `isPlaying changed: ${direction} at ${progress.position.toFixed(3)} (awaiting=${awaitingIsPlayingMatch})`,
  );

  if (awaitingIsPlayingMatch === direction) {
    log.debug(`Skipping - matches awaited direction from command`);
    awaitingIsPlayingMatch = null;
    return;
  }

  // No playthrough loaded - nothing to record
  if (!playthrough) {
    return;
  }

  // External event - emit immediately
  emitPlayPauseEvent({
    direction,
    source: PlayPauseSource.EXTERNAL,
    timestamp: Date.now(),
    position: progress.position,
    playbackRate,
    playthroughId: playthrough.id,
  });
}

type EmitPlayPauseParams = {
  direction: PlayPauseDirection;
  source: PlayPauseSourceType;
  timestamp: number;
  position: number;
  playbackRate: number;
  playthroughId: string;
};

/**
 * Emit a canonical play/pause event to the store.
 */
function emitPlayPauseEvent(params: EmitPlayPauseParams) {
  log.info(
    `${params.direction} at ${params.position.toFixed(3)} (source: ${params.source})`,
  );

  useTrackPlayer.setState({
    lastPlayPause: {
      timestamp: params.timestamp,
      type:
        params.direction === "play" ? PlayPauseType.PLAY : PlayPauseType.PAUSE,
      source: params.source,
      playthroughId: params.playthroughId,
      position: params.position,
      playbackRate: params.playbackRate,
    },
  });
}

// Debug: Log state changes
useTrackPlayer.subscribe((state) => {
  log.silly(`State changed: ${JSON.stringify(state, null, 2)}`);
});
