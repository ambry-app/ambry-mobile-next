import { useEffect } from "react";
import { AppStateStatus, EmitterSubscription } from "react-native";
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  isPlaying,
} from "react-native-track-player";
import { create } from "zustand";

import {
  FINISH_PROMPT_THRESHOLD,
  PAUSE_REWIND_SECONDS,
  PLAYER_EXPAND_ANIMATION_DURATION,
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/constants";
import {
  getFinishedOrAbandonedPlaythrough,
  getInProgressPlaythrough,
  getPlaythroughById,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import * as Coordinator from "@/services/playback-coordinator";
import * as Transitions from "@/services/playthrough-transitions";

import { Session, useSession } from "./session";

export const SeekSource = {
  BUTTON: "button",
  CHAPTER: "chapter",
  REMOTE: "remote",
  SCRUBBER: "scrubber",
  PAUSE: "pause",
} as const;

export type SeekSourceType = (typeof SeekSource)[keyof typeof SeekSource];

export interface PendingResumePrompt {
  mediaId: string;
  playthroughId: string;
  playthroughStatus: "finished" | "abandoned";
  position: number;
  duration: number;
  statusDate: Date;
}

export interface PendingFinishPrompt {
  /** The playthrough that's about to be unloaded */
  currentPlaythroughId: string;
  currentMediaId: string;
  currentMediaTitle: string;
  currentPosition: number;
  currentDuration: number;
  /** The new media the user wants to load */
  newMediaId: string;
}

export interface PlayerState {
  /* initialization state */

  initialized: boolean;
  initializationError: unknown | null;
  playthroughId: string | null;
  mediaId: string | null;
  streaming: boolean | undefined;
  loadingNewMedia: boolean;

  /* prompt state */

  /** When set, shows a dialog asking user to resume or start fresh */
  pendingResumePrompt: PendingResumePrompt | null;

  /** When set, shows a dialog asking user if they want to mark current playthrough as finished */
  pendingFinishPrompt: PendingFinishPrompt | null;

  /* playback state */

  /** Current TrackPlayer position */
  position: number;
  /** Current TrackPlayer duration */
  duration: number;
  /** Current TrackPlayer playback rate */
  playbackRate: number;

  /** Whether mini player content should render (true when collapsed or animating) */
  shouldRenderMini: boolean;
  /** Whether expanded player content should render (true when expanded or animating) */
  shouldRenderExpanded: boolean;

  /* seek state */

  /** Whether the user is currently seeking, multiple taps will accumulate before applying */
  userIsSeeking: boolean;
  /** Whether the seek is currently being applied to the player, taps will be ignored while this is true */
  seekIsApplying: boolean;
  /** The effective difference between the seek base position and the current seek position */
  seekOriginalPosition: number | null;
  /** The base position from which relative seek is calculated */
  seekBasePosition: number | null;
  /** The accumulated relative seek amount */
  seekAccumulator: number | null;
  /** The current absolute seek position that will apply after the timeout */
  seekPosition: number | null;
  /** The position from which the analytics seek event started */
  seekEffectiveDiff: number | null;
  /** The original position from which the seek started */
  seekEventFrom: number | null;
  /** The position to which the analytics seek event will apply */
  seekEventTo: number | null;
  /** The timestamp when the seek was actually applied (for accurate event recording) */
  seekEventTimestamp: Date | null;
  /** Direction of the last seek button press ('left' for backward, 'right' for forward) */
  seekLastDirection: "left" | "right" | null;

  /* chapter state */

  chapters: schema.Chapter[];
  currentChapter: schema.Chapter | undefined;
  previousChapterStartTime: number;
}

const initialState = {
  playthroughId: null,
  mediaId: null,
  streaming: undefined,
  loadingNewMedia: false,
  pendingResumePrompt: null,
  pendingFinishPrompt: null,
  position: 0,
  duration: 0,
  playbackRate: 1,
  shouldRenderMini: false,
  shouldRenderExpanded: true,
  userIsSeeking: false,
  seekIsApplying: false,
  seekOriginalPosition: null,
  seekBasePosition: null,
  seekAccumulator: null,
  seekPosition: null,
  seekEffectiveDiff: null,
  seekEventFrom: null,
  seekEventTo: null,
  seekEventTimestamp: null,
  seekLastDirection: null,
  chapters: [],
  currentChapter: undefined,
  previousChapterStartTime: 0,
};

export const usePlayer = create<PlayerState>()(() => ({
  initialized: false,
  initializationError: null,
  ...initialState,
}));

/**
 * Initialize the player store.
 * Sets up TrackPlayer and loads the most recent media if not already initialized.
 */
export async function initializePlayer(session: Session) {
  if (usePlayer.getState().initialized) {
    console.debug("[Player] Already initialized, skipping");
    return;
  }

  console.debug("[Player] Initializing");

  try {
    const response = await setupTrackPlayer(session);

    if (response === true || response === null) {
      // TrackPlayer set up but no track loaded yet (true),
      // or track loaded but playthrough not found (null)
      if (response === null) {
        // Reset TrackPlayer since the loaded track is invalid
        await TrackPlayer.reset();
      }
      usePlayer.setState({ initialized: true });

      // Try to load the stored active playthrough
      const track = await Transitions.loadActivePlaythroughIntoPlayer(session);
      if (track) {
        usePlayer.setState({
          playthroughId: track.playthroughId,
          mediaId: track.mediaId,
          duration: track.duration,
          position: track.position,
          playbackRate: track.playbackRate,
          streaming: track.streaming,
          ...initialChapterState(
            track.chapters,
            track.position,
            track.duration,
          ),
        });
      }
    } else {
      // TrackPlayer already had a track (shouldn't happen on fresh init, but handle it)
      usePlayer.setState({
        initialized: true,
        playthroughId: response.playthroughId,
        mediaId: response.mediaId,
        duration: response.duration,
        position: response.position,
        playbackRate: response.playbackRate,
        streaming: response.streaming,
        ...initialChapterState(
          response.chapters,
          response.position,
          response.duration,
        ),
      });
    }
  } catch (error) {
    usePlayer.setState({ initializationError: error });
  }
}

export function prepareToLoadMedia() {
  usePlayer.setState({ loadingNewMedia: true });
}

/**
 * Load media into TrackPlayer (low-level, no pause, no play).
 * Used by downloads.ts when reloading after download completes.
 * For normal "play this media" use cases, use Transitions.loadAndPlayMedia instead.
 */
export async function loadMedia(session: Session, mediaId: string) {
  const track = await Transitions.loadMediaIntoPlayer(session, mediaId);

  usePlayer.setState({
    loadingNewMedia: false,
    playthroughId: track.playthroughId,
    mediaId: track.mediaId,
    duration: track.duration,
    position: track.position,
    playbackRate: track.playbackRate,
    streaming: track.streaming,
    ...initialChapterState(track.chapters, track.position, track.duration),
  });
}

/**
 * Resume a specific playthrough and load it into the player.
 * Can be used to resume any abandoned/finished playthrough by ID.
 */
export async function resumeAndLoadPlaythrough(
  session: Session,
  playthroughId: string,
) {
  console.debug("[Player] Resuming playthrough:", playthroughId);

  usePlayer.setState({ loadingNewMedia: true });
  await expandPlayerAndWait();

  // Transitions service handles pause, load, play, and state updates
  await Transitions.resumePlaythroughAndPlay(session, playthroughId);
}

/**
 * Handle user choosing to resume a previous playthrough.
 * Called from the ResumePlaythroughDialog.
 */
export async function handleResumePlaythrough(session: Session) {
  const prompt = usePlayer.getState().pendingResumePrompt;
  if (!prompt) return;

  usePlayer.setState({ pendingResumePrompt: null });
  await resumeAndLoadPlaythrough(session, prompt.playthroughId);
}

/**
 * Handle user choosing to start fresh (new playthrough).
 * Called from the ResumePlaythroughDialog.
 */
export async function handleStartFresh(session: Session) {
  const prompt = usePlayer.getState().pendingResumePrompt;
  if (!prompt) return;

  console.debug(
    "[Player] User chose to start fresh for media:",
    prompt.mediaId,
  );

  usePlayer.setState({ pendingResumePrompt: null, loadingNewMedia: true });
  await expandPlayerAndWait();

  // Transitions service handles pause, create, load, play, and state updates
  await Transitions.startFreshAndPlay(session, prompt.mediaId);
}

/**
 * Cancel the resume prompt without making a choice.
 */
export function cancelResumePrompt() {
  usePlayer.setState({ pendingResumePrompt: null, loadingNewMedia: false });
}

// =============================================================================
// Finish Prompt (when unloading a playthrough that's almost complete)
// =============================================================================

/**
 * Check if the current playthrough should prompt for finish before loading new media.
 * If so, sets pendingFinishPrompt and returns true.
 * If not, returns false and the caller should proceed with loading.
 */
export async function checkForFinishPrompt(
  session: Session,
  newMediaId: string,
): Promise<boolean> {
  const { playthroughId, mediaId, position, duration } = usePlayer.getState();

  // No current media loaded - nothing to prompt about
  if (!playthroughId || !mediaId) return false;

  // Same media being loaded - no prompt needed
  if (mediaId === newMediaId) return false;

  // Check if position is > 95% of duration
  if (duration <= 0) return false;
  const percentComplete = position / duration;
  if (percentComplete <= FINISH_PROMPT_THRESHOLD) return false;

  // Get the current playthrough info for the dialog (we need the book title)
  const currentPlaythrough = await getPlaythroughById(session, playthroughId);
  if (!currentPlaythrough) return false;

  console.debug(
    "[Player] Current playthrough is",
    (percentComplete * 100).toFixed(1) + "%",
    "complete - showing finish prompt",
  );

  usePlayer.setState({
    pendingFinishPrompt: {
      currentPlaythroughId: playthroughId,
      currentMediaId: mediaId,
      currentMediaTitle: currentPlaythrough.media.book.title,
      currentPosition: position,
      currentDuration: duration,
      newMediaId,
    },
  });

  return true;
}

/**
 * Handle user choosing to mark the current playthrough as finished.
 * Called from the FinishPlaythroughDialog.
 */
export async function handleMarkFinished(session: Session) {
  const prompt = usePlayer.getState().pendingFinishPrompt;
  if (!prompt) return;

  console.debug(
    "[Player] User chose to mark playthrough as finished:",
    prompt.currentPlaythroughId,
  );

  // Clear the prompt and start loading
  usePlayer.setState({ pendingFinishPrompt: null, loadingNewMedia: true });

  // Finish the current playthrough (skip unload since we're loading new media)
  await Transitions.finishPlaythrough(session, prompt.currentPlaythroughId, {
    skipUnload: true,
  });

  // Now load the new media
  await proceedWithLoadingNewMedia(session, prompt.newMediaId);
}

/**
 * Handle user choosing to skip marking as finished and just load the new media.
 * Called from the FinishPlaythroughDialog.
 */
export async function handleSkipFinish(session: Session) {
  const prompt = usePlayer.getState().pendingFinishPrompt;
  if (!prompt) return;

  console.debug(
    "[Player] User chose to skip marking as finished, loading new media:",
    prompt.newMediaId,
  );

  // Clear the prompt and start loading
  usePlayer.setState({ pendingFinishPrompt: null, loadingNewMedia: true });

  // Load the new media without marking current as finished
  await proceedWithLoadingNewMedia(session, prompt.newMediaId);
}

/**
 * Cancel the finish prompt without making a choice.
 */
export function cancelFinishPrompt() {
  usePlayer.setState({ pendingFinishPrompt: null });
}

/**
 * Internal helper to proceed with loading new media after finish prompt is resolved.
 */
async function proceedWithLoadingNewMedia(
  session: Session,
  newMediaId: string,
) {
  await expandPlayerAndWait();

  // Check if new media has a finished/abandoned playthrough that needs resume prompt
  const needsResumePrompt = await checkForResumePrompt(session, newMediaId);
  if (needsResumePrompt) {
    // Resume dialog will handle the rest
    return;
  }

  // No resume prompt needed - transitions service handles pause, load, play
  await Transitions.loadAndPlayMedia(session, newMediaId);
}

/**
 * Check if loading this media would trigger a resume prompt.
 * If so, sets pendingResumePrompt and returns true.
 * If not, returns false and the caller should proceed with loading.
 */
export async function checkForResumePrompt(
  session: Session,
  mediaId: string,
): Promise<boolean> {
  // Check for active (in_progress) playthrough - no prompt needed
  const activePlaythrough = await getInProgressPlaythrough(session, mediaId);
  if (activePlaythrough) {
    return false;
  }

  // Check for finished or abandoned playthrough
  const previousPlaythrough = await getFinishedOrAbandonedPlaythrough(
    session,
    mediaId,
  );

  if (
    previousPlaythrough &&
    (previousPlaythrough.status === "finished" ||
      previousPlaythrough.status === "abandoned")
  ) {
    console.debug(
      "[Player] Found previous playthrough:",
      previousPlaythrough.id,
      "status:",
      previousPlaythrough.status,
      "- showing prompt",
    );

    const statusDate =
      previousPlaythrough.status === "finished"
        ? previousPlaythrough.finishedAt
        : previousPlaythrough.abandonedAt;

    usePlayer.setState({
      loadingNewMedia: false,
      pendingResumePrompt: {
        mediaId,
        playthroughId: previousPlaythrough.id,
        playthroughStatus: previousPlaythrough.status,
        position: previousPlaythrough.stateCache?.currentPosition ?? 0,
        duration: parseFloat(previousPlaythrough.media.duration || "0"),
        statusDate: statusDate || new Date(),
      },
    });

    return true;
  }

  return false;
}

export function expandPlayer() {
  Coordinator.expandPlayer();
}

export function setPlayerRenderState(
  shouldRenderMini: boolean,
  shouldRenderExpanded: boolean,
) {
  usePlayer.setState({ shouldRenderMini, shouldRenderExpanded });
}

/**
 * Expand the player and wait for the expansion animation to complete.
 * Uses a timeout matching the animation duration defined in CustomTabBarWithPlayer.
 */
export function expandPlayerAndWait(): Promise<void> {
  Coordinator.expandPlayer();
  return new Promise((resolve) => {
    setTimeout(resolve, PLAYER_EXPAND_ANIMATION_DURATION);
  });
}

export async function play() {
  const { position } = await TrackPlayer.getProgress();
  console.debug("[Player] Playing from position", position);
  await TrackPlayer.play();
  Coordinator.onPlay();
}

export async function pause() {
  const { position } = await TrackPlayer.getProgress();
  console.debug("[Player] Pausing at position", position);
  await TrackPlayer.pause();
  await seekImmediateNoLog(-PAUSE_REWIND_SECONDS, true);
  Coordinator.onPause();
}

/**
 * Pause playback only if currently playing.
 * Use this before loading new media to avoid unnecessary pause events
 * and side effects when nothing is actually playing.
 */
export async function pauseIfPlaying() {
  const { playing } = await isPlaying();
  if (playing) {
    await pause();
  }
}

export function seekTo(position: number, source: SeekSourceType) {
  seek(position, false, source);
}

export function seekRelative(amount: number, source: SeekSourceType) {
  seek(amount, true, source);
}

export function skipToEndOfChapter() {
  const { currentChapter, duration } = usePlayer.getState();
  if (!currentChapter) return;

  return seek(currentChapter.endTime || duration, false, SeekSource.CHAPTER);
}

export function skipToBeginningOfChapter() {
  const { position, currentChapter, previousChapterStartTime } =
    usePlayer.getState();
  if (!currentChapter) return;

  const newPosition =
    position === currentChapter.startTime
      ? previousChapterStartTime
      : currentChapter.startTime;

  return seek(newPosition, false, SeekSource.CHAPTER);
}

export async function setPlaybackRate(session: Session, playbackRate: number) {
  const previousRate = usePlayer.getState().playbackRate;
  usePlayer.setState({ playbackRate });

  await TrackPlayer.setRate(playbackRate);

  // Notify coordinator for event recording
  const { position } = await TrackPlayer.getProgress();
  Coordinator.onRateChanged({
    previousRate,
    newRate: playbackRate,
    position,
  });
}

export async function tryUnloadPlayer() {
  try {
    if (seekTimer) clearTimeout(seekTimer);
    // TODO: will we miss important seek events?
    if (seekEventTimer) clearTimeout(seekEventTimer);

    await pauseIfPlaying();
    await TrackPlayer.reset();
    usePlayer.setState({ ...initialState });
  } catch (error) {
    console.warn("[Player] tryUnloadPlayer error", error);
  }

  return Promise.resolve();
}

export async function forceUnloadPlayer() {
  if (seekTimer) clearTimeout(seekTimer);
  // TODO: will we miss important seek events?
  if (seekEventTimer) clearTimeout(seekEventTimer);

  await TrackPlayer.reset();
  usePlayer.setState({ ...initialState });

  return Promise.resolve();
}

function onPlaybackQueueEnded() {
  const { duration } = usePlayer.getState();
  console.debug("[Player] PlaybackQueueEnded at position", duration);
  setProgress(duration, duration);
}

/**
 * Update player position and duration state.
 * Exported so the coordinator can call it for seek updates.
 */
export function setProgress(position: number, duration: number) {
  usePlayer.setState({ position, duration });
  maybeUpdateChapterState();
}

async function setupTrackPlayer(
  session: Session,
): Promise<Transitions.TrackLoadResult | true | null> {
  try {
    // just checking to see if it's already initialized
    const track = await TrackPlayer.getTrack(0);

    if (track) {
      // The description field contains the playthroughId
      const playthroughId = track.description!;
      const streaming = track.url.startsWith("http");
      const progress = await TrackPlayer.getProgress();
      const position = progress.position;
      const duration = progress.duration;
      const playbackRate = await TrackPlayer.getRate();

      // Get playthrough with full media info
      const playthrough = await getPlaythroughById(session, playthroughId);

      if (!playthrough) {
        console.warn(
          "[Player] Track loaded but playthrough not found:",
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
  } catch (error) {
    console.debug("[Player] player not yet set up", error);
    // it's ok, we'll set it up now
  }

  await TrackPlayer.setupPlayer({
    androidAudioContentType: AndroidAudioContentType.Speech,
    iosCategory: IOSCategory.Playback,
    iosCategoryMode: IOSCategoryMode.SpokenAudio,
    autoHandleInterruptions: true,
  });

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

  console.debug("[Player] TrackPlayer setup succeeded");
  return true;
}

function initialChapterState(
  chapters: schema.Chapter[],
  position: number,
  duration: number,
) {
  const currentChapter = chapters.find(
    (chapter) => position < (chapter.endTime || duration),
  );

  if (!currentChapter)
    return {
      chapters,
      currentChapter,
      previousChapterStartTime: 0,
    };

  const previousChapterStartTime =
    chapters[chapters.indexOf(currentChapter) - 1]?.startTime || 0;

  return { chapters, currentChapter, previousChapterStartTime };
}

function maybeUpdateChapterState() {
  const { position, currentChapter } = usePlayer.getState();

  if (!currentChapter) {
    return;
  }

  if (
    position < currentChapter.startTime ||
    (currentChapter.endTime && position >= currentChapter.endTime)
  ) {
    const { duration, chapters } = usePlayer.getState();
    const nextChapter = chapters.find(
      (chapter) => position < (chapter.endTime || duration),
    );

    if (nextChapter) {
      usePlayer.setState({
        currentChapter: nextChapter,
        previousChapterStartTime:
          chapters[chapters.indexOf(nextChapter) - 1]?.startTime || 0,
      });
    }
  }
}

let seekTimer: NodeJS.Timeout | null = null;
let seekEventTimer: NodeJS.Timeout | null = null;

async function seek(
  target: number,
  isRelative: boolean,
  source: SeekSourceType,
) {
  const { seekIsApplying } = usePlayer.getState();
  if (seekIsApplying) return;

  if (!seekTimer || !seekEventTimer) {
    const { position } = await TrackPlayer.getProgress();

    // First tap for short timer
    if (!seekTimer) {
      usePlayer.setState({
        userIsSeeking: true,
        seekOriginalPosition: position,
        seekBasePosition: position,
        seekAccumulator: 0,
        seekPosition: position,
        seekEffectiveDiff: 0,
      });
    }

    // First tap for long timer
    if (!seekEventTimer) {
      usePlayer.setState({
        seekEventFrom: position,
      });
    }
  }

  // Each tap
  if (isRelative) {
    const seekLastDirection = target < 0 ? "left" : "right";

    usePlayer.setState((state) => {
      if (
        state.seekAccumulator == null ||
        state.seekBasePosition == null ||
        state.seekOriginalPosition == null
      ) {
        throw new Error("Seek state invalid");
      }

      const seekAccumulator = state.seekAccumulator + target;
      let seekPosition =
        state.seekBasePosition + seekAccumulator * state.playbackRate;
      const seekEffectiveDiff = seekPosition - state.seekOriginalPosition;

      seekPosition = Math.max(0, Math.min(seekPosition, state.duration));

      return {
        seekAccumulator,
        seekPosition,
        seekEffectiveDiff,
        seekLastDirection,
      };
    });
  } else {
    usePlayer.setState((state) => {
      if (state.seekOriginalPosition == null) {
        throw new Error("Seek state invalid");
      }

      const seekBasePosition = target;
      let seekPosition = target;
      const seekEffectiveDiff = seekPosition - state.seekOriginalPosition;
      const seekLastDirection = seekEffectiveDiff < 0 ? "left" : "right";

      seekPosition = Math.max(0, Math.min(seekPosition, state.duration));

      return {
        seekBasePosition,
        seekAccumulator: 0,
        seekPosition,
        seekEffectiveDiff,
        seekLastDirection,
      };
    });
  }

  if (seekTimer) clearTimeout(seekTimer);
  if (seekEventTimer) clearTimeout(seekEventTimer);

  // On short delay, apply the seek
  seekTimer = setTimeout(async () => {
    seekTimer = null;
    const { seekPosition, seekOriginalPosition, duration } =
      usePlayer.getState();

    console.debug(
      "[Player] Seeking from",
      seekOriginalPosition,
      "to",
      seekPosition,
    );

    if (seekPosition == null) {
      throw new Error("Seek state invalid");
    }

    usePlayer.setState({ seekIsApplying: true });

    await TrackPlayer.seekTo(seekPosition);
    const seekEventTimestamp = new Date();
    Coordinator.onSeekApplied({
      position: seekPosition,
      duration,
      userInitiated: true,
      source,
    });
    usePlayer.setState({
      userIsSeeking: false,
      seekIsApplying: false,
      seekOriginalPosition: null,
      seekBasePosition: null,
      seekAccumulator: null,
      seekPosition: null,
      seekEffectiveDiff: null,
      seekLastDirection: null,
      seekEventTo: seekPosition,
      seekEventTimestamp,
    });
  }, SEEK_ACCUMULATION_WINDOW);

  // On longer delay, emit debounced seek event for recording
  seekEventTimer = setTimeout(() => {
    seekEventTimer = null;
    const { seekEventFrom, seekEventTo, seekEventTimestamp } =
      usePlayer.getState();

    if (
      seekEventFrom == null ||
      seekEventTo == null ||
      seekEventTimestamp == null
    ) {
      throw new Error("Seek event state invalid");
    }

    console.debug(
      "[Player] Debounced seek from",
      seekEventFrom,
      "to",
      seekEventTo,
    );

    Coordinator.onSeekCompleted({
      fromPosition: seekEventFrom,
      toPosition: seekEventTo,
      timestamp: seekEventTimestamp,
    });

    usePlayer.setState({
      seekEventFrom: null,
      seekEventTo: null,
      seekEventTimestamp: null,
    });
  }, SEEK_EVENT_ACCUMULATION_WINDOW);
}

async function seekImmediateNoLog(target: number, isRelative = false) {
  const { seekIsApplying, playbackRate } = usePlayer.getState();
  if (seekIsApplying) return;

  usePlayer.setState({ seekIsApplying: true });

  const { position, duration } = await TrackPlayer.getProgress();
  let seekPosition;

  if (isRelative) {
    seekPosition = position + target * playbackRate;
  } else {
    seekPosition = target;
  }

  seekPosition = Math.max(0, Math.min(seekPosition, duration));

  console.debug(
    "[Player] Seeking from",
    position,
    "to",
    seekPosition,
    "without logging",
  );

  await TrackPlayer.seekTo(seekPosition);
  Coordinator.onSeekApplied({
    position: seekPosition,
    duration,
    userInitiated: false,
    source: SeekSource.PAUSE,
  });
  usePlayer.setState({ seekIsApplying: false });
}

// Interval for progress polling
const POSITION_POLL_INTERVAL = 1000; // 1 second for position/duration

export function usePlayerSubscriptions(appState: AppStateStatus) {
  const playerLoaded = usePlayer((state) => !!state.mediaId);

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];
    let positionIntervalId: NodeJS.Timeout | null = null;

    const pollPosition = async () => {
      const progress = await TrackPlayer.getProgress();
      setProgress(progress.position, progress.duration);
    };

    const init = async () => {
      console.debug("[Player] Getting initial progress");
      const progress = await TrackPlayer.getProgress();
      setProgress(progress.position, progress.duration);
    };

    if (appState === "active" && playerLoaded) {
      init();

      console.debug("[Player] Subscribing to player events");

      // Poll position/duration every 1 second
      positionIntervalId = setInterval(pollPosition, POSITION_POLL_INTERVAL);

      subscriptions.push(
        TrackPlayer.addEventListener(
          Event.PlaybackQueueEnded,
          onPlaybackQueueEnded,
        ),
      );
    }

    return () => {
      if (positionIntervalId) clearInterval(positionIntervalId);
      if (subscriptions.length !== 0)
        console.debug("[Player] Unsubscribing from player events");
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [appState, playerLoaded]);
}

// =============================================================================
// Reactive Session Cleanup
// =============================================================================

// Subscribe to session changes - when signed out, clean up the player
useSession.subscribe((state, prevState) => {
  if (prevState.session && !state.session) {
    console.debug("[Player] Session signed out, cleaning up player");
    forceUnloadPlayer().catch((error) => {
      console.warn("[Player] Error during session cleanup:", error);
    });
  }
});

// Register callback for playthrough-transitions to unload player (breaks circular dependency)
Transitions.setUnloadPlayerCallback(tryUnloadPlayer);
