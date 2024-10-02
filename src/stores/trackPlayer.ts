import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { and, desc, eq } from "drizzle-orm";
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  Track,
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
  initTrack: (session: Session) => Promise<void>;
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
      const response = await setupTrackPlayerAsync();

      if (response === true) {
        set({ setup: true });
      } else {
        set({ setup: true, mediaId: response.description });
      }
    } catch (error) {
      set({ setupError: error });
    }
  },
  initTrack: async (session: Session) => {
    const result = await loadMostRecentPlayerStateIntoPlayer(session);
    if (result) {
      set({
        mediaId: result.mediaId,
        duration: result.duration,
        position: result.position,
        playbackRate: result.playbackRate,
      });
    }
  },
}));

async function setupTrackPlayerAsync(): Promise<Track | true> {
  try {
    const track = await TrackPlayer.getTrack(0);
    console.log("[TrackPlayer] already set up");
    return track || true;
  } catch (error) {
    console.log("[TrackPlayer] not set up yet", error);
  }

  await TrackPlayer.setupPlayer({
    androidAudioContentType: AndroidAudioContentType.Speech,
    iosCategory: IOSCategory.Playback,
    iosCategoryMode: IOSCategoryMode.SpokenAudio,
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
      Capability.Stop,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.JumpBackward,
      Capability.JumpForward,
    ],
    forwardJumpInterval: 10,
    backwardJumpInterval: 10,
  });

  console.log("[TrackPlayer] setup succeeded");
  return true;
}

// situations when wanting to load a media:
//
// - neither a synced playerState nor a local playerState exists
//   - create a new local playerState
// - a synced playerState exists but no local playerState exists
//   - create a new local playerState by copying the synced playerState
// - a local playerState exists but no synced playerState exists
//   - use it as is
// - both a synced playerState and a local playerState exist
//   - compare the two playerStates updatedAt
//     - if the synced playerState is newer
//       - update the local playerState by copying the synced playerState
//     - if the local playerState is newer
//       - use it as is

interface TrackLoadResult {
  mediaId: string | null;
  duration: number;
  position: number;
  playbackRate: number;
}

async function loadMostRecentPlayerStateIntoPlayer(
  session: Session,
): Promise<TrackLoadResult | null> {
  console.log("Loading most recent player state into player...");

  const track = await TrackPlayer.getActiveTrack();
  if (track) {
    console.log("TrackPlayer track already loaded, skipping");
    const mediaId = track.description || null;
    const progress = await TrackPlayer.getProgress();
    const position = progress.position;
    const duration = progress.duration;
    const playbackRate = await TrackPlayer.getRate();
    return { mediaId, position, duration, playbackRate };
  }

  const playerState = await db.query.playerStates.findFirst({
    where: and(
      eq(schema.playerStates.url, session.url),
      eq(schema.playerStates.userEmail, session.email),
      eq(schema.playerStates.status, "in_progress"),
    ),
    orderBy: desc(schema.playerStates.updatedAt),
    with: {
      media: {
        columns: {
          id: true,
          thumbnails: true,
          mpdPath: true,
          hlsPath: true,
          duration: true,
        },
        with: {
          book: {
            columns: { id: true, title: true },
            with: {
              bookAuthors: {
                columns: { id: true },
                with: {
                  author: {
                    columns: { id: true, name: true },
                    with: { person: { columns: { id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!playerState) {
    console.log("No most recent player state found");
    return null;
  }

  console.log("Most recent player state:", playerState);

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
      ? `${session.url}/${playerState.media.thumbnails!.extraLarge}`
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
