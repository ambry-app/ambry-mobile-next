/**
 * Zustand store for Track Player state.
 *
 * This is the low-level playback state that all services will need, regardless
 * of wether the UI is mounted or not. If only the UI needs something, it
 * belongs in the player-ui-state store instead.
 *
 * Chapter state is an exception, since it's so tightly tied to position.
 */

import { create } from "zustand";

import { Chapter } from "@/types/db-schema";
import { PlaybackState, Progress, State } from "@/types/track-player";

export type LoadedPlaythrough = {
  id: string;
  mediaId: string;
  status: "in_progress" | "finished" | "abandoned";
};

export type ProgressWithPercent = Progress & {
  percent: number;
};

export const SeekSource = {
  BUTTON: "button",
  CHAPTER: "chapter",
  REMOTE: "remote",
  SCRUBBER: "scrubber",
  INTERNAL: "internal",
} as const;

export type SeekSourceType = (typeof SeekSource)[keyof typeof SeekSource];

export type Seek = {
  timestamp: number;
  source: SeekSourceType;
  from: number;
  to: number;
};

export const PlayPauseType = {
  PLAY: "play",
  PAUSE: "pause",
} as const;

export type PlayPauseCommand = {
  timestamp: number;
  type: (typeof PlayPauseType)[keyof typeof PlayPauseType];
  at: number;
};

export type PlayPauseEvent = {
  timestamp: number;
  type: (typeof PlayPauseType)[keyof typeof PlayPauseType];
  position: number;
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
  playthrough: LoadedPlaythrough | undefined;
  chapters: Chapter[];
  currentChapter: Chapter | null;
  previousChapter: Chapter | null;
  lastSeek: Seek | null;
  lastPlayPauseCommand: PlayPauseCommand | null;
  lastPlayPause: PlayPauseEvent | null;
}

export const initialState = {
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
  chapters: [],
  currentChapter: null,
  previousChapter: null,
  lastSeek: null,
  lastPlayPauseCommand: null,
  lastPlayPause: null,
};

export const useTrackPlayer = create<TrackPlayerState>()(() => ({
  initialized: false,
  ...initialState,
}));
