import { type PlaybackState, Progress, State } from "react-native-track-player";
import { create } from "zustand";

export type Playthrough = {
  url: string;
  id: string;
  updatedAt: Date;
  mediaId: string;
  status: "in_progress" | "finished" | "abandoned";
  userEmail: string;
  startedAt: Date;
  finishedAt: Date | null;
  abandonedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  syncedAt: Date | null;
  stateCache: {
    updatedAt: Date;
    playthroughId: string;
    currentPosition: number;
    currentRate: number;
    lastEventAt: Date;
    totalListeningTime: number | null;
  };
};

export type ProgressWithPercent = Progress & {
  percent: number;
};

export interface TrackPlayerState {
  initialized: boolean;
  playbackState: PlaybackState;
  playWhenReady: boolean;
  isPlaying: {
    playing: boolean;
    bufferingDuringPlay: boolean;
  };
  playbackRate: number;
  progress: ProgressWithPercent;
  streaming: boolean | undefined;
  playthrough: Playthrough | undefined;
}

const initialState = {
  playbackState: { state: State.None } as PlaybackState,
  playWhenReady: false,
  isPlaying: {
    playing: false,
    bufferingDuringPlay: false,
  },
  playbackRate: 1.0,
  progress: { position: 0, duration: 0, buffered: 0, percent: 0 },
  streaming: undefined,
  playthrough: undefined,
};

export const useTrackPlayer = create<TrackPlayerState>()(() => ({
  initialized: false,
  ...initialState,
}));
