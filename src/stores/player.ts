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
import { Session } from "./session";

export type ChapterState = {
  chapters: schema.Chapter[];
  currentChapter: schema.Chapter;
  previousChapterStartTime: number;
};

export interface PlayerState {
  setup: boolean;
  setupError: unknown | null;
  mediaId: string | null;
  position: number;
  duration: number;
  playbackRate: number;
  lastPlayerExpandRequest: Date | undefined;
  streaming: boolean | undefined;
  chapterState: ChapterState | null;
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
  mediaId: null,
  position: 0,
  duration: 0,
  playbackRate: 1,
  lastPlayerExpandRequest: undefined,
  streaming: undefined,
  chapterState: null,
}));

export async function setupPlayer(session: Session) {
  if (usePlayer.getState().setup) {
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
        chapterState: initializeChapterState(
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

export async function loadMostRecentMedia(session: Session) {
  if (!usePlayer.getState().setup) return;

  const track = await loadMostRecentMediaIntoTrackPlayer(session);

  if (track) {
    usePlayer.setState({
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

export function updateProgress(position: number, duration: number) {
  usePlayer.setState({ position, duration });

  const chapterState = usePlayer.getState().chapterState;

  if (chapterState) {
    usePlayer.setState({
      chapterState: updateChapterState(chapterState, position, duration),
    });
  }
}

export async function seekRelative(amount: number) {
  const { playbackRate } = usePlayer.getState();
  const { state } = await TrackPlayer.getPlaybackState();
  if (!shouldSeek(state)) return;
  const { position, duration } = await TrackPlayer.getProgress();

  let newPosition = position + amount * playbackRate;
  if (newPosition < 0) newPosition = 0;
  if (newPosition > duration) newPosition = duration;

  TrackPlayer.seekTo(newPosition);
  updateProgress(newPosition, duration);
}

export async function seekRelativeUnsafe(amount: number) {
  const { position, duration, playbackRate } = usePlayer.getState();
  // TODO: what about checking the track player state?
  let newPosition = position + amount * playbackRate;
  if (newPosition < 0) newPosition = 0;
  if (newPosition > duration) newPosition = duration;

  updateProgress(newPosition, duration);
  TrackPlayer.seekTo(newPosition);
}

export async function seekTo(position: number) {
  const { duration } = usePlayer.getState();
  const newPosition = Math.max(0, Math.min(position, duration));
  updateProgress(newPosition, duration);
  return TrackPlayer.seekTo(newPosition);
}

export async function skipToEndOfChapter() {
  const { chapterState, duration } = usePlayer.getState();
  if (!chapterState) return;

  const { currentChapter } = chapterState;
  const newPosition = currentChapter.endTime || duration;
  updateProgress(newPosition, duration);
  TrackPlayer.seekTo(newPosition);
}

export async function skipToBeginningOfChapter() {
  const { chapterState, position, duration } = usePlayer.getState();
  if (!chapterState) return;

  const { currentChapter, previousChapterStartTime } = chapterState;
  const newPosition =
    position === currentChapter.startTime
      ? previousChapterStartTime
      : currentChapter.startTime;
  updateProgress(newPosition, duration);
  TrackPlayer.seekTo(newPosition);
}

export async function setPlaybackRate(session: Session, playbackRate: number) {
  usePlayer.setState({ playbackRate });
  await Promise.all([
    TrackPlayer.setRate(playbackRate),
    updatePlayerState(session, usePlayer.getState().mediaId!, { playbackRate }),
  ]);
}

export async function unloadPlayer() {
  await TrackPlayer.reset();
}

function shouldSeek(state: State): boolean {
  switch (state) {
    case State.Paused:
    case State.Stopped:
    case State.Ready:
    case State.Playing:
    case State.Ended:
      return true;
    case State.Buffering:
    case State.Loading:
    case State.None:
    case State.Error:
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
    console.debug("[TrackPlayer] player not yet set up", error);
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
    progressUpdateEventInterval: 5,
  });

  console.log("[TrackPlayer] setup succeeded");
  return true;
}

/**
 * Loads the given PlayerState into the player.
 */
async function loadPlayerState(
  session: Session,
  playerState: LocalPlayerState,
): Promise<TrackLoadResult> {
  console.log("Loading player state into player...");
  let streaming: boolean;

  await TrackPlayer.reset();
  if (playerState.media.download?.status === "ready") {
    // the media is downloaded, load the local file
    streaming = false;
    await TrackPlayer.add({
      url: playerState.media.download.filePath,
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

  if (!syncedPlayerState && !localPlayerState) {
    // neither a synced playerState nor a local playerState exists
    // create a new local playerState and load it into the player
    const newLocalPlayerState = await createInitialPlayerState(
      session,
      mediaId,
    );

    return loadPlayerState(session, newLocalPlayerState);
  }

  if (syncedPlayerState && !localPlayerState) {
    // a synced playerState exists but no local playerState exists
    // create a new local playerState by copying the synced playerState
    const newLocalPlayerState = await createPlayerState(
      session,
      mediaId,
      syncedPlayerState.playbackRate,
      syncedPlayerState.position,
      syncedPlayerState.status,
    );

    return loadPlayerState(session, newLocalPlayerState);
  }

  if (!syncedPlayerState && localPlayerState) {
    // a local playerState exists but no synced playerState exists
    // use it as is (we haven't had a chance to sync it to the server yet)
    return loadPlayerState(session, localPlayerState);
  }

  // both a synced playerState and a local playerState exist
  if (!localPlayerState || !syncedPlayerState) throw new Error("Impossible");

  if (localPlayerState.updatedAt >= syncedPlayerState.updatedAt) {
    // the local playerState is newer
    // use it as is (the server is out of date)
    return loadPlayerState(session, localPlayerState);
  }

  // the synced playerState is newer
  // update the local playerState by copying the synced playerState
  const updatedLocalPlayerState = await updatePlayerState(session, mediaId, {
    playbackRate: syncedPlayerState.playbackRate,
    position: syncedPlayerState.position,
    status: syncedPlayerState.status,
  });

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
