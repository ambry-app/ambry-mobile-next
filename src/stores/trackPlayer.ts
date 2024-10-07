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
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  TrackType,
} from "react-native-track-player";
import { create } from "zustand";
import { Session } from "./session";

interface TrackPlayerState {
  setup: boolean;
  setupError: unknown | null;
  mediaId: string | null;
  duration: number;
  position: number;
  playbackRate: number;
  setupTrackPlayer: () => Promise<void>;
  loadMostRecentMedia: (session: Session) => Promise<void>;
  loadMedia: (session: Session, mediaId: string) => Promise<void>;
}

interface TrackLoadResult {
  mediaId: string;
  duration: number;
  position: number;
  playbackRate: number;
}

export const useTrackPlayerStore = create<TrackPlayerState>()((set, get) => ({
  setup: false,
  setupError: null,
  mediaId: null,
  duration: 0,
  position: 0,
  playbackRate: 1,
  setupTrackPlayer: async () => {
    if (get().setup) {
      return;
    }

    try {
      const response = await setupTrackPlayer();

      if (response === true) {
        set({ setup: true });
      } else {
        set({
          setup: true,
          mediaId: response.mediaId,
          duration: response.duration,
          position: response.position,
          playbackRate: response.playbackRate,
        });
      }
    } catch (error) {
      set({ setupError: error });
    }
  },
  loadMostRecentMedia: async (session: Session) => {
    if (!get().setup) return;

    const track = await loadMostRecentMedia(session);

    if (track) {
      set({
        mediaId: track.mediaId,
        duration: track.duration,
        position: track.position,
        playbackRate: track.playbackRate,
      });
    }
  },
  loadMedia: async (session: Session, mediaId: string) => {
    const track = await loadMedia(session, mediaId);

    set({
      mediaId: track.mediaId,
      duration: track.duration,
      position: track.position,
      playbackRate: track.playbackRate,
    });
  },
}));

async function setupTrackPlayer(): Promise<TrackLoadResult | true> {
  try {
    // just checking to see if it's already initialized
    const track = await TrackPlayer.getTrack(0);

    if (track) {
      const mediaId = track.description!;
      const progress = await TrackPlayer.getProgress();
      const position = progress.position;
      const duration = progress.duration;
      const playbackRate = await TrackPlayer.getRate();
      return { mediaId, position, duration, playbackRate };
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

  await TrackPlayer.reset();
  await TrackPlayer.add({
    // FIXME: iOS use HLS
    url: `${session.url}${playerState.media.mpdPath}`,
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

  await TrackPlayer.seekTo(playerState.position);
  await TrackPlayer.setRate(playerState.playbackRate);

  return {
    mediaId: playerState.media.id,
    duration: parseFloat(playerState.media.duration || "0"),
    position: playerState.position,
    playbackRate: playerState.playbackRate,
  };
}

async function loadMedia(
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

async function loadMostRecentMedia(
  session: Session,
): Promise<TrackLoadResult | null> {
  const track = await TrackPlayer.getTrack(0);

  if (track) {
    const mediaId = track.description!;
    const progress = await TrackPlayer.getProgress();
    const position = progress.position;
    const duration = progress.duration;
    const playbackRate = await TrackPlayer.getRate();
    return { mediaId, position, duration, playbackRate };
  }

  const mostRecentSyncedMedia =
    await getMostRecentInProgressSyncedMedia(session);
  const mostRecentLocalMedia = await getMostRecentInProgressLocalMedia(session);

  if (!mostRecentSyncedMedia && !mostRecentLocalMedia) {
    return null;
  }

  if (mostRecentSyncedMedia && !mostRecentLocalMedia) {
    return loadMedia(session, mostRecentSyncedMedia.mediaId);
  }

  if (!mostRecentSyncedMedia && mostRecentLocalMedia) {
    return loadMedia(session, mostRecentLocalMedia.mediaId);
  }

  if (!mostRecentSyncedMedia || !mostRecentLocalMedia)
    throw new Error("Impossible");

  if (mostRecentLocalMedia.updatedAt >= mostRecentSyncedMedia.updatedAt) {
    return loadMedia(session, mostRecentLocalMedia.mediaId);
  } else {
    return loadMedia(session, mostRecentSyncedMedia.mediaId);
  }
}
