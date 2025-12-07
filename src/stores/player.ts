import {
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/src/constants";
import {
  LocalPlayerState,
  createInitialPlayerState,
  createPlayerState,
  getLocalPlayerState,
  getMostRecentInProgressLocalMedia,
  getMostRecentInProgressSyncedMedia,
  getSyncedPlayerState,
  updatePlayerState,
} from "@/src/db/player-states";
import * as schema from "@/src/db/schema";
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
import { Session } from "./session";

export const SeekSource = {
  BUTTON: "button",
  CHAPTER: "chapter",
  REMOTE: "remote",
  SCRUBBER: "scrubber",
  PAUSE: "pause",
} as const;

export type SeekSourceType = (typeof SeekSource)[keyof typeof SeekSource];

export interface PlayerState {
  /* setup state */

  setup: boolean;
  setupError: unknown | null;
  mediaId: string | null;
  streaming: boolean | undefined;
  loadingNewMedia: boolean;

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
  setup: false,
  setupError: null,
  ...initialState,
}));

export async function setupPlayer(session: Session) {
  if (usePlayer.getState().setup) {
    console.debug("[Player] already set up");
    return;
  }

  try {
    const response = await setupTrackPlayer(session);

    if (response === true) {
      usePlayer.setState({ setup: true });
    } else {
      usePlayer.setState({
        setup: true,
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
    usePlayer.setState({ setupError: error });
  }
}

export function prepareToLoadMedia() {
  usePlayer.setState({ loadingNewMedia: true });
}

export async function loadMostRecentMedia(session: Session) {
  if (!usePlayer.getState().setup) return;

  const track = await loadMostRecentMediaIntoTrackPlayer(session);

  if (track) {
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

export async function loadMedia(session: Session, mediaId: string) {
  const track = await loadMediaIntoTrackPlayer(session, mediaId);

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
  EventBus.emit("playbackPaused", { remote: false });
  await seekImmediateNoLog(-1, true);
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
  usePlayer.setState({ playbackRate });
  await Promise.all([
    TrackPlayer.setRate(playbackRate),
    // updatePlayerState(session, usePlayer.getState().mediaId!, { playbackRate }),
  ]);
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
  console.debug("[Player] PlaybackProgressUpdated", progress);
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

// async function savePosition(force: boolean = false) {
//   const session = useSession.getState().session;
//   const { mediaId, position, duration } = usePlayer.getState();

//   if (!session || !mediaId) return;

//   // mimic server-side logic here by computing the status
//   const status =
//     position < 60
//       ? "not_started"
//       : duration - position < 120
//         ? "finished"
//         : "in_progress";

//   await updatePlayerState(session, mediaId, { position, status });
// }

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
      const playerState = await getLocalPlayerState(session, mediaId);
      return {
        mediaId,
        position,
        duration,
        playbackRate,
        streaming,
        chapters: playerState?.media.chapters || [],
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

  console.debug("[Player] setup succeeded");
  return true;
}

/**
 * Loads the given PlayerState into the player.
 */
async function loadPlayerState(
  session: Session,
  playerState: LocalPlayerState,
): Promise<TrackLoadResult> {
  console.debug("[Player] Loading player state into player...");
  let streaming: boolean;

  await TrackPlayer.reset();
  if (playerState.media.download?.status === "ready") {
    // the media is downloaded, load the local file
    streaming = false;
    await TrackPlayer.add({
      url: documentDirectoryFilePath(playerState.media.download.filePath),
      pitchAlgorithm: PitchAlgorithm.Voice,
      duration: playerState.media.duration
        ? parseFloat(playerState.media.duration)
        : undefined,
      title: playerState.media.book.title,
      artist: playerState.media.book.bookAuthors
        .map((bookAuthor) => bookAuthor.author.name)
        .join(", "),
      artwork: playerState.media.download.thumbnails
        ? documentDirectoryFilePath(
            playerState.media.download.thumbnails.extraLarge,
          )
        : undefined,
      description: playerState.media.id,
    });
  } else {
    // the media is not downloaded, load the stream
    streaming = true;
    await TrackPlayer.add({
      url:
        Platform.OS === "ios"
          ? `${session.url}${playerState.media.hlsPath}`
          : `${session.url}${playerState.media.mpdPath}`,
      type: TrackType.Dash,
      pitchAlgorithm: PitchAlgorithm.Voice,
      duration: playerState.media.duration
        ? parseFloat(playerState.media.duration)
        : undefined,
      title: playerState.media.book.title,
      artist: playerState.media.book.bookAuthors
        .map((bookAuthor) => bookAuthor.author.name)
        .join(", "),
      artwork: playerState.media.thumbnails
        ? `${session.url}/${playerState.media.thumbnails.extraLarge}`
        : undefined,
      description: playerState.media.id,
      headers: { Authorization: `Bearer ${session.token}` },
    });
  }

  await TrackPlayer.seekTo(playerState.position);
  await TrackPlayer.setRate(playerState.playbackRate);

  return {
    mediaId: playerState.media.id,
    duration: parseFloat(playerState.media.duration || "0"),
    position: playerState.position,
    playbackRate: playerState.playbackRate,
    chapters: playerState.media.chapters,
    streaming,
  };
}

async function loadMediaIntoTrackPlayer(
  session: Session,
  mediaId: string,
): Promise<TrackLoadResult> {
  const syncedPlayerState = await getSyncedPlayerState(session, mediaId);
  const localPlayerState = await getLocalPlayerState(session, mediaId);

  console.debug("[Player] Loading media into player", mediaId);

  if (!syncedPlayerState && !localPlayerState) {
    // neither a synced playerState nor a local playerState exists
    // create a new local playerState and load it into the player

    console.debug(
      "[Player] No state found; creating new local state; new position =",
      0,
    );

    const newLocalPlayerState = await createInitialPlayerState(
      session,
      mediaId,
    );

    return loadPlayerState(session, newLocalPlayerState);
  }

  if (syncedPlayerState && !localPlayerState) {
    // a synced playerState exists but no local playerState exists
    // create a new local playerState by copying the synced playerState

    console.debug(
      "[Player] Synced state found; creating new local state; synced position =",
      syncedPlayerState.position,
    );

    const newLocalPlayerState = await createPlayerState(
      session,
      mediaId,
      syncedPlayerState.playbackRate,
      syncedPlayerState.position,
      syncedPlayerState.status,
    );

    console.debug(
      "[Player] Loading new local state into player; local position =",
      newLocalPlayerState.position,
    );

    return loadPlayerState(session, newLocalPlayerState);
  }

  if (!syncedPlayerState && localPlayerState) {
    // a local playerState exists but no synced playerState exists
    // use it as is (we haven't had a chance to sync it to the server yet)

    console.debug(
      "[Player] Local state found (but no synced state); loading into player; local position =",
      localPlayerState.position,
    );

    return loadPlayerState(session, localPlayerState);
  }

  if (!localPlayerState || !syncedPlayerState) throw new Error("Impossible");

  // both a synced playerState and a local playerState exist
  console.debug(
    "[Player] Both synced and local states found; local position =",
    localPlayerState.position + ";",
    "synced position =",
    syncedPlayerState.position,
  );

  if (localPlayerState.updatedAt >= syncedPlayerState.updatedAt) {
    // the local playerState is newer
    // use it as is (the server is out of date)

    console.debug(
      "[Player] Local state is newer; loading into player; local position =",
      localPlayerState.position,
    );

    return loadPlayerState(session, localPlayerState);
  }

  // the synced playerState is newer
  // update the local playerState by copying the synced playerState

  console.debug(
    "[Player] Synced state is newer; updating local state; synced position =",
    syncedPlayerState.position,
  );

  const updatedLocalPlayerState = await updatePlayerState(session, mediaId, {
    playbackRate: syncedPlayerState.playbackRate,
    position: syncedPlayerState.position,
    status: syncedPlayerState.status,
  });

  console.debug(
    "[Player] Loading updated local state into player; local position =",
    updatedLocalPlayerState.position,
  );

  return loadPlayerState(session, updatedLocalPlayerState);
}

async function loadMostRecentMediaIntoTrackPlayer(
  session: Session,
): Promise<TrackLoadResult | null> {
  const track = await TrackPlayer.getTrack(0);

  if (track) {
    const streaming = track.url.startsWith("http");
    const mediaId = track.description!;
    const progress = await TrackPlayer.getProgress();
    const position = progress.position;
    const duration = progress.duration;
    const playbackRate = await TrackPlayer.getRate();
    const playerState = await getLocalPlayerState(session, mediaId);
    return {
      mediaId,
      position,
      duration,
      playbackRate,
      streaming,
      chapters: playerState?.media.chapters || [],
    };
  }

  const mostRecentSyncedMedia =
    await getMostRecentInProgressSyncedMedia(session);
  const mostRecentLocalMedia = await getMostRecentInProgressLocalMedia(session);

  if (!mostRecentSyncedMedia && !mostRecentLocalMedia) {
    return null;
  }

  if (mostRecentSyncedMedia && !mostRecentLocalMedia) {
    return loadMediaIntoTrackPlayer(session, mostRecentSyncedMedia.mediaId);
  }

  if (!mostRecentSyncedMedia && mostRecentLocalMedia) {
    return loadMediaIntoTrackPlayer(session, mostRecentLocalMedia.mediaId);
  }

  if (!mostRecentSyncedMedia || !mostRecentLocalMedia)
    throw new Error("Impossible");

  if (mostRecentLocalMedia.updatedAt >= mostRecentSyncedMedia.updatedAt) {
    return loadMediaIntoTrackPlayer(session, mostRecentLocalMedia.mediaId);
  } else {
    return loadMediaIntoTrackPlayer(session, mostRecentSyncedMedia.mediaId);
  }
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

  // On longer delay, save the seek event to the database
  seekEventTimer = setTimeout(() => {
    seekEventTimer = null;
    const { seekEventFrom, seekEventTo } = usePlayer.getState();

    console.debug("[Player] Seek event from", seekEventFrom, "to", seekEventTo);

    if (seekEventFrom == null || seekEventTo == null) {
      throw new Error("Seek event state invalid");
    }

    // TODO: Save the seek event to the database
    // NOTE: ignore events if they're not "meaningful"

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
