/** The player vocabulary the services, stores and wrapper share. */

export type PlayerState = "idle" | "buffering" | "ready" | "ended";

export enum TrackType {
  Default = "default",
  Dash = "dash",
  HLS = "hls",
}

export interface Track {
  url: string;
  type?: TrackType;
  title?: string;
  artist?: string;
  artwork?: string;
  duration?: number;
  headers?: Record<string, string>;
}

export type AddTrack = Track;

export interface Progress {
  position: number;
  duration: number;
  buffered: number;
}
