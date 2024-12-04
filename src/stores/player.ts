import {
  LocalPlayerState,
  createInitialPlayerState,
  createPlayerState,
  getLocalPlayerState,
  getMostRecentInProgressLocalMedia,
  getMostRecentInProgressSyncedMedia,
  getSyncedPlayerState,
  updatePlayerState,
} from "@/src/db/playerStates";
import * as schema from "@/src/db/schema";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled,
  setSleepTimerTime,
} from "@/src/db/settings";
import { syncUp } from "@/src/db/sync";
import { documentDirectoryFilePath } from "@/src/utils/paths";
import { Platform } from "react-native";
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  State,
  TrackType,
} from "react-native-track-player";
import { create } from "zustand";
import { Session, useSession } from "./session";

export type ChapterState = {
  chapters: schema.Chapter[];
  currentChapter: schema.Chapter;
  previousChapterStartTime: number;
};

export interface PlayerState {
  setup: boolean;
  setupError: unknown | null;
  position: number;
  duration: number;
  state: State | undefined;
  mediaId: string | null;
  playbackRate: number;
  lastPlayerExpandRequest: Date | undefined;
  streaming: boolean | undefined;
  chapterState: ChapterState | null;
  sleepTimer: number;
  sleepTimerEnabled: boolean;
  sleepTimerTriggerTime: number | null;
  loadingNewMedia: boolean;
}

interface TrackLoadResult {
  mediaId: string;
  duration: number;
  position: number;
  playbackRate: number;
  streaming: boolean;
  chapters: schema.Chapter[];
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  setup: false,
  setupError: null,
  position: 0,
  duration: 0,
  state: undefined,
  mediaId: null,
  playbackRate: 1,
  lastPlayerExpandRequest: undefined,
  streaming: undefined,
  chapterState: null,
  sleepTimer: schema.defaultSleepTimer,
  sleepTimerEnabled: schema.defaultSleepTimerEnabled,
  sleepTimerTriggerTime: null,
  loadingNewMedia: false,
}));

export async function setupPlayer(session: Session) {
  if (usePlayer.getState().setup) {
    console.debug("[Player] already set up");
    return;
  }

  try {
    const response = await setupTrackPlayer(session);

    if (response === true) {
      const { sleepTimer, sleepTimerEnabled } = await getSleepTimerSettings(
        session.email,
      );

      usePlayer.setState({ setup: true, sleepTimer, sleepTimerEnabled });
    } else {
      const { sleepTimer, sleepTimerEnabled } = await getSleepTimerSettings(
        session.email,
      );

      usePlayer.setState({
        setup: true,
        mediaId: response.mediaId,
        duration: response.duration,
        position: response.position,
        playbackRate: response.playbackRate,
        streaming: response.streaming,
        chapterState: initializeChapterState(
          response.chapters,
          response.position,
          response.duration,
        ),
        sleepTimer,
        sleepTimerEnabled,
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
      chapterState: initializeChapterState(
        track.chapters,
        track.position,
        track.duration,
      ),
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
    chapterState: initializeChapterState(
      track.chapters,
      track.position,
      track.duration,
    ),
  });
}

export function requestExpandPlayer() {
  usePlayer.setState({ lastPlayerExpandRequest: new Date() });
}

export function expandPlayerHandled() {
  usePlayer.setState({ lastPlayerExpandRequest: undefined });
}

export function playOrPause() {
  const { state } = usePlayer.getState();

  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
    case State.Error:
      return play();
    case State.Playing:
      return pause();
    case State.Buffering:
    case State.Loading:
    case State.None:
    case State.Ended:
  }
  return Promise.resolve();
}

export function play() {
  maybeStartSleepTimer();
  return TrackPlayer.play();
}

export async function pause() {
  stopSleepTimer();
  await TrackPlayer.pause();
  await seekRelative(-1);
  return savePosition(true);
}

export function onPlaybackProgressUpdated(position: number, duration: number) {
  updateProgress(position, duration);
  if (maybeHandleSleepTimer()) return Promise.resolve();
  return savePosition();
}

export function onPlaybackState(state: State) {
  usePlayer.setState({ state });
}

export function onPlaybackQueueEnded() {
  stopSleepTimer();
  const { duration } = usePlayer.getState();
  updateProgress(duration, duration);
  return savePosition(true);
}

export function updateProgress(position: number, duration: number) {
  usePlayer.setState({ position, duration });

  const chapterState = usePlayer.getState().chapterState;

  if (chapterState) {
    usePlayer.setState({
      chapterState: updateChapterState(chapterState, position, duration),
    });
  }
}

export async function seekTo(position: number) {
  maybeResetSleepTimer();
  const { duration, state } = usePlayer.getState();
  if (!shouldSeek(state)) return;
  const newPosition = Math.max(0, Math.min(position, duration));
  updateProgress(newPosition, duration);

  return TrackPlayer.seekTo(newPosition);
}

export async function seekRelative(amount: number) {
  const { position, playbackRate } = usePlayer.getState();

  return seekTo(position + amount * playbackRate);
}

export async function skipToEndOfChapter() {
  const { chapterState, duration } = usePlayer.getState();
  if (!chapterState) return;
  const { currentChapter } = chapterState;

  return seekTo(currentChapter.endTime || duration);
}

export async function skipToBeginningOfChapter() {
  const { chapterState, position } = usePlayer.getState();
  if (!chapterState) return;

  const { currentChapter, previousChapterStartTime } = chapterState;
  const newPosition =
    position === currentChapter.startTime
      ? previousChapterStartTime
      : currentChapter.startTime;

  return seekTo(newPosition);
}

export async function setPlaybackRate(session: Session, playbackRate: number) {
  usePlayer.setState({ playbackRate });
  await Promise.all([
    TrackPlayer.setRate(playbackRate),
    updatePlayerState(session, usePlayer.getState().mediaId!, { playbackRate }),
  ]);
  return syncUp(session, true);
}

export async function setSleepTimerState(enabled: boolean) {
  usePlayer.setState({
    sleepTimerEnabled: enabled,
    sleepTimerTriggerTime: null,
  });

  const session = useSession.getState().session;

  if (!session) return;

  await setSleepTimerEnabled(session.email, enabled);

  const { state } = usePlayer.getState();

  if (state === State.Playing) {
    maybeStartSleepTimer();
  }
}

export async function setSleepTimer(sleepTimer: number) {
  usePlayer.setState({ sleepTimer });

  const session = useSession.getState().session;

  if (!session) return;

  await setSleepTimerTime(session.email, sleepTimer);

  const { state } = usePlayer.getState();

  if (state === State.Playing) {
    maybeResetSleepTimer();
  }
}

export async function tryUnloadPlayer() {
  try {
    await pause();
    await TrackPlayer.reset();
    usePlayer.setState({
      position: 0,
      duration: 0,
      state: undefined,
      mediaId: null,
      playbackRate: 1,
      streaming: undefined,
      chapterState: null,
    });
  } catch (error) {
    console.warn("[Player] tryUnloadPlayer error", error);
  }

  return Promise.resolve();
}

async function savePosition(force: boolean = false) {
  const session = useSession.getState().session;
  const { mediaId, position, duration } = usePlayer.getState();

  if (!session || !mediaId) return;

  // mimic server-side logic here by computing the status
  const status =
    position < 60
      ? "not_started"
      : duration - position < 120
        ? "finished"
        : "in_progress";

  await updatePlayerState(session, mediaId, { position, status });
  return syncUp(session, force);
}

function shouldSeek(state: State | undefined): boolean {
  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
    case State.Playing:
    case State.Ended:
    case State.Buffering:
    case State.Loading:
      return true;
    case State.None:
    case State.Error:
    case undefined:
      return false;
  }
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
    compactCapabilities: [
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
        ? playerState.media.download.thumbnails.extraLarge
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

    console.debug("[Player] No state found; creating new local state", 0);

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
      "[Player] Synced state found; creating new local state",
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
      "[Player] Loading new local state into player",
      newLocalPlayerState.position,
    );

    return loadPlayerState(session, newLocalPlayerState);
  }

  if (!syncedPlayerState && localPlayerState) {
    // a local playerState exists but no synced playerState exists
    // use it as is (we haven't had a chance to sync it to the server yet)

    console.debug(
      "[Player] Local state found (but no synced state); loading into player",
      localPlayerState.position,
    );

    return loadPlayerState(session, localPlayerState);
  }

  if (!localPlayerState || !syncedPlayerState) throw new Error("Impossible");

  // both a synced playerState and a local playerState exist
  console.debug(
    "[Player] Both synced and local states found",
    localPlayerState.position,
    syncedPlayerState.position,
  );

  if (localPlayerState.updatedAt >= syncedPlayerState.updatedAt) {
    // the local playerState is newer
    // use it as is (the server is out of date)

    console.debug(
      "[Player] Local state is newer; loading into player",
      localPlayerState.position,
    );

    return loadPlayerState(session, localPlayerState);
  }

  // the synced playerState is newer
  // update the local playerState by copying the synced playerState

  console.debug(
    "[Player] Synced state is newer; updating local state",
    syncedPlayerState.position,
  );

  const updatedLocalPlayerState = await updatePlayerState(session, mediaId, {
    playbackRate: syncedPlayerState.playbackRate,
    position: syncedPlayerState.position,
    status: syncedPlayerState.status,
  });

  console.debug(
    "[Player] Loading updated local state into player",
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

function initializeChapterState(
  chapters: schema.Chapter[],
  position: number,
  duration: number,
): ChapterState | null {
  const currentChapter = chapters.find(
    (chapter) => position < (chapter.endTime || duration),
  );

  if (!currentChapter) return null;

  const previousChapterStartTime =
    chapters[chapters.indexOf(currentChapter) - 1]?.startTime || 0;

  return { chapters, currentChapter, previousChapterStartTime };
}

function updateChapterState(
  chapterState: ChapterState,
  position: number,
  duration: number,
) {
  const { chapters, currentChapter } = chapterState;

  if (
    position < currentChapter.startTime ||
    (currentChapter.endTime && position >= currentChapter.endTime)
  ) {
    const nextChapter = chapters.find(
      (chapter) => position < (chapter.endTime || duration),
    );

    if (nextChapter) {
      const previousChapterStartTime =
        chapters[chapters.indexOf(nextChapter) - 1]?.startTime || 0;
      return {
        chapters,
        currentChapter: nextChapter,
        previousChapterStartTime,
      };
    }

    return chapterState;
  }

  return chapterState;
}

function maybeStartSleepTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = usePlayer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime !== null) return;

  _startSleepTimer();
}

function maybeResetSleepTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = usePlayer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime === null) return;

  _startSleepTimer();
}

function stopSleepTimer() {
  usePlayer.setState({ sleepTimerTriggerTime: null });
}

function _startSleepTimer() {
  const { sleepTimer } = usePlayer.getState();
  const triggerTime = Date.now() + sleepTimer * 1000;

  usePlayer.setState({ sleepTimerTriggerTime: triggerTime });
}

function maybeHandleSleepTimer() {
  const { sleepTimerTriggerTime } = usePlayer.getState();

  if (sleepTimerTriggerTime === null) return false;

  const now = Date.now();

  if (now >= sleepTimerTriggerTime) {
    pause();
    return true;
  }

  return false;
}
