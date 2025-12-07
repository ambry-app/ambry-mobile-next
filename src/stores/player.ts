import {
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/src/constants";
import { db } from "@/src/db/db";
import {
  ActivePlaythrough,
  createPlaythrough,
  getActivePlaythrough,
  getFinishedOrAbandonedPlaythrough,
  getMostRecentInProgressPlaythrough,
  resumePlaythrough,
} from "@/src/db/playthroughs";
import * as schema from "@/src/db/schema";
import {
  initializePlaythroughTracking,
  recordStartEvent,
} from "@/src/services/event-recording-service";
import { EventBus, documentDirectoryFilePath } from "@/src/utils";
import { useEffect } from "react";
import { AppStateStatus, EmitterSubscription, Platform } from "react-native";
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  Progress,
  TrackType,
} from "react-native-track-player";
import { create } from "zustand";
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
}

export interface PlayerState {
  /* initialization state */

  initialized: boolean;
  initializationError: unknown | null;
  mediaId: string | null;
  streaming: boolean | undefined;
  loadingNewMedia: boolean;

  /* resume prompt state */

  /** When set, shows a dialog asking user to resume or start fresh */
  pendingResumePrompt: PendingResumePrompt | null;

  /* playback state */

  /** Current TrackPlayer position */
  position: number;
  /** Current TrackPlayer duration */
  duration: number;
  /** Current TrackPlayer playback rate */
  playbackRate: number;

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

  /* chapter state */

  chapters: schema.Chapter[];
  currentChapter: schema.Chapter | undefined;
  previousChapterStartTime: number;
}

interface TrackLoadResult {
  mediaId: string;
  duration: number;
  position: number;
  playbackRate: number;
  streaming: boolean;
  chapters: schema.Chapter[];
}

const initialState = {
  mediaId: null,
  streaming: undefined,
  loadingNewMedia: false,
  pendingResumePrompt: null,
  position: 0,
  duration: 0,
  playbackRate: 1,
  userIsSeeking: false,
  seekIsApplying: false,
  seekOriginalPosition: null,
  seekBasePosition: null,
  seekAccumulator: null,
  seekPosition: null,
  seekEffectiveDiff: null,
  seekEventFrom: null,
  seekEventTo: null,
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

    if (response === true) {
      // TrackPlayer set up but no track loaded yet
      usePlayer.setState({ initialized: true });

      // Try to load most recent media
      const track = await loadMostRecentMediaIntoTrackPlayer(session);
      if (track) {
        usePlayer.setState({
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

export async function loadMedia(session: Session, mediaId: string) {
  const track = await loadMediaIntoTrackPlayer(session, mediaId);

  // If a prompt is pending, don't overwrite state - user needs to make a choice
  if (usePlayer.getState().pendingResumePrompt) {
    return;
  }

  usePlayer.setState({
    loadingNewMedia: false,
    mediaId: track.mediaId,
    duration: track.duration,
    position: track.position,
    playbackRate: track.playbackRate,
    streaming: track.streaming,
    ...initialChapterState(track.chapters, track.position, track.duration),
  });
}

/**
 * Handle user choosing to resume a previous playthrough.
 * Called from the ResumePlaythroughDialog.
 */
export async function handleResumePlaythrough(session: Session) {
  const prompt = usePlayer.getState().pendingResumePrompt;
  if (!prompt) return;

  console.debug(
    "[Player] User chose to resume playthrough:",
    prompt.playthroughId,
  );

  // Clear the prompt
  usePlayer.setState({ pendingResumePrompt: null, loadingNewMedia: true });

  // Resume the playthrough
  await resumePlaythrough(db, session, prompt.playthroughId);

  // Load it into the player
  const playthrough = await getActivePlaythrough(db, session, prompt.mediaId);
  if (playthrough) {
    const track = await loadPlaythroughIntoTrackPlayer(session, playthrough);
    usePlayer.setState({
      loadingNewMedia: false,
      mediaId: track.mediaId,
      duration: track.duration,
      position: track.position,
      playbackRate: track.playbackRate,
      streaming: track.streaming,
      ...initialChapterState(track.chapters, track.position, track.duration),
    });
  }
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

  // Clear the prompt
  usePlayer.setState({ pendingResumePrompt: null, loadingNewMedia: true });

  // Create a new playthrough
  const playthroughId = await createPlaythrough(db, session, prompt.mediaId);
  await recordStartEvent(playthroughId);

  // Load it into the player
  const playthrough = await getActivePlaythrough(db, session, prompt.mediaId);
  if (playthrough) {
    const track = await loadPlaythroughIntoTrackPlayer(session, playthrough);
    usePlayer.setState({
      loadingNewMedia: false,
      mediaId: track.mediaId,
      duration: track.duration,
      position: track.position,
      playbackRate: track.playbackRate,
      streaming: track.streaming,
      ...initialChapterState(track.chapters, track.position, track.duration),
    });
  }
}

/**
 * Cancel the resume prompt without making a choice.
 */
export function cancelResumePrompt() {
  usePlayer.setState({ pendingResumePrompt: null });
}

export function expandPlayer() {
  EventBus.emit("expandPlayer");
}

export async function play() {
  const { position } = await TrackPlayer.getProgress();
  console.debug("[Player] Playing from position", position);
  await TrackPlayer.play();
  EventBus.emit("playbackStarted", { remote: false });
}

export async function pause() {
  const { position } = await TrackPlayer.getProgress();
  console.debug("[Player] Pausing at position", position);
  await TrackPlayer.pause();
  await seekImmediateNoLog(-1, true);
  EventBus.emit("playbackPaused", { remote: false });
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

  // Emit event for event recording service
  const { position } = await TrackPlayer.getProgress();
  EventBus.emit("playbackRateChanged", {
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

    await pause();
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

function onPlaybackProgressUpdated(progress: Progress) {
  setProgress(progress.position, progress.duration);
}

function onPlaybackQueueEnded() {
  const { duration } = usePlayer.getState();
  console.debug("[Player] PlaybackQueueEnded at position", duration);
  setProgress(duration, duration);
}

function onSeekApplied(progress: Progress) {
  console.debug("[Player] seekApplied", progress);
  setProgress(progress.position, progress.duration);
}

function setProgress(position: number, duration: number) {
  usePlayer.setState({ position, duration });

  maybeUpdateChapterState();
}

async function setupTrackPlayer(
  session: Session,
): Promise<TrackLoadResult | true> {
  try {
    // just checking to see if it's already initialized
    const track = await TrackPlayer.getTrack(0);

    if (track) {
      const streaming = track.url.startsWith("http");
      const mediaId = track.description!;
      const progress = await TrackPlayer.getProgress();
      const position = progress.position;
      const duration = progress.duration;
      const playbackRate = await TrackPlayer.getRate();
      const playthrough = await getActivePlaythrough(db, session, mediaId);
      return {
        mediaId,
        position,
        duration,
        playbackRate,
        streaming,
        chapters: playthrough?.media.chapters || [],
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

/**
 * Loads a playthrough into TrackPlayer.
 */
async function loadPlaythroughIntoTrackPlayer(
  session: Session,
  playthrough: ActivePlaythrough,
): Promise<TrackLoadResult> {
  console.debug("[Player] Loading playthrough into player...");

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

async function loadMediaIntoTrackPlayer(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  console.debug("[Player] Loading media into player", mediaId);

  // Check for active (in_progress) playthrough
  let playthrough = await getActivePlaythrough(db, session, mediaId);

  if (playthrough) {
    console.debug(
      "[Player] Found active playthrough:",
      playthrough.id,
      "position:",
      playthrough.stateCache?.currentPosition ?? 0,
    );
    return loadPlaythroughIntoTrackPlayer(session, playthrough);
  }

  // Check for finished or abandoned playthrough
  const previousPlaythrough = await getFinishedOrAbandonedPlaythrough(
    db,
    session,
    mediaId,
  );

  if (
    previousPlaythrough &&
    (previousPlaythrough.status === "finished" ||
      previousPlaythrough.status === "abandoned")
  ) {
    // Show "Resume or start fresh?" prompt
    console.debug(
      "[Player] Found previous playthrough:",
      previousPlaythrough.id,
      "status:",
      previousPlaythrough.status,
      "- showing prompt",
    );

    usePlayer.setState({
      loadingNewMedia: false,
      pendingResumePrompt: {
        mediaId,
        playthroughId: previousPlaythrough.id,
        playthroughStatus: previousPlaythrough.status,
        position: previousPlaythrough.stateCache?.currentPosition ?? 0,
      },
    });

    // Return early - the user will make a choice via the dialog
    // For now, return a placeholder result (won't be used since loadingNewMedia is false)
    return {
      mediaId,
      duration: 0,
      position: 0,
      playbackRate: 1,
      streaming: true,
      chapters: [],
    };
  }

  // No playthrough exists - create a new one
  console.debug("[Player] No playthrough found; creating new one");

  const playthroughId = await createPlaythrough(db, session, mediaId);
  await recordStartEvent(playthroughId);

  playthrough = await getActivePlaythrough(db, session, mediaId);

  if (!playthrough) {
    throw new Error("Failed to create playthrough");
  }

  return loadPlaythroughIntoTrackPlayer(session, playthrough);
}

async function loadMostRecentMediaIntoTrackPlayer(
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
    const playthrough = await getActivePlaythrough(db, session, mediaId);

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
  const mostRecentPlaythrough = await getMostRecentInProgressPlaythrough(
    db,
    session,
  );

  if (!mostRecentPlaythrough) {
    console.debug("[Player] No in-progress playthrough found");
    return null;
  }

  console.debug(
    "[Player] Loading most recent playthrough:",
    mostRecentPlaythrough.id,
    "mediaId:",
    mostRecentPlaythrough.mediaId,
  );

  return loadMediaIntoTrackPlayer(session, mostRecentPlaythrough.mediaId);
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

  if (!currentChapter) return;

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

      seekPosition = Math.max(0, Math.min(seekPosition, state.duration));

      return {
        seekBasePosition,
        seekAccumulator: 0,
        seekPosition,
        seekEffectiveDiff,
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
    EventBus.emit("seekApplied", {
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
      seekEventTo: seekPosition,
    });
  }, SEEK_ACCUMULATION_WINDOW);

  // On longer delay, emit debounced seek event for recording
  seekEventTimer = setTimeout(() => {
    seekEventTimer = null;
    const { seekEventFrom, seekEventTo } = usePlayer.getState();

    if (seekEventFrom == null || seekEventTo == null) {
      throw new Error("Seek event state invalid");
    }

    console.debug(
      "[Player] Debounced seek from",
      seekEventFrom,
      "to",
      seekEventTo,
    );

    EventBus.emit("seekCompleted", {
      fromPosition: seekEventFrom,
      toPosition: seekEventTo,
    });

    usePlayer.setState({
      seekEventFrom: null,
      seekEventTo: null,
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
  EventBus.emit("seekApplied", {
    position: seekPosition,
    duration,
    userInitiated: false,
    source: SeekSource.PAUSE,
  });
  usePlayer.setState({ seekIsApplying: false });
}

export function usePlayerSubscriptions(appState: AppStateStatus) {
  const playerLoaded = usePlayer((state) => !!state.mediaId);

  useEffect(() => {
    const subscriptions: EmitterSubscription[] = [];

    const init = async () => {
      console.debug("[Player] Getting initial progress");
      const progress = await TrackPlayer.getProgress();

      setProgress(progress.position, progress.duration);
    };

    if (appState === "active" && playerLoaded) {
      init();

      console.debug("[Player] Subscribing to player events");

      // TODO: maybe use `useProgress` so the interval is controllable by us. Or maybe write our own...
      subscriptions.push(
        TrackPlayer.addEventListener(
          Event.PlaybackProgressUpdated,
          onPlaybackProgressUpdated,
        ),
      );

      subscriptions.push(
        TrackPlayer.addEventListener(
          Event.PlaybackQueueEnded,
          onPlaybackQueueEnded,
        ),
      );

      EventBus.on("seekApplied", onSeekApplied);
    }

    return () => {
      if (subscriptions.length !== 0)
        console.debug("[Player] Unsubscribing from player events");
      subscriptions.forEach((sub) => sub.remove());
      EventBus.off("seekApplied", onSeekApplied);
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
