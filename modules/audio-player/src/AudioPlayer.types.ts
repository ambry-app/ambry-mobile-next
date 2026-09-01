/** One file of a recording, as the native queue sees it. */
export type NativeTrack = {
  url: string;
  title?: string;
  artist?: string;
  artwork?: string;
  headers?: Record<string, string>;
  /** "default" sniffs the container; legacy media streams "dash" or "hls". */
  type: "default" | "dash" | "hls";
  /**
   * Seconds, advisory. The player derives real durations from the media; this
   * exists so a queue knows its shape before anything has buffered.
   */
  duration?: number;
};

/**
 * The player's whole observable state in one read, all of it track-relative.
 * Book-time translation belongs to the wrapper, which owns the timeline.
 */
export type PlayerSnapshot = {
  state: "idle" | "buffering" | "ready" | "ended";
  playing: boolean;
  playWhenReady: boolean;
  index: number;
  positionSeconds: number;
  durationSeconds: number;
  bufferedSeconds: number;
  rate: number;
};

/**
 * A transport command from the notification, lock screen or a media key,
 * delivered un-acted: the native side swallowed it and nothing has happened
 * yet. JS decides what it means (rate-scaled seeks, pause-rewind) and drives
 * the player through the ordinary API.
 */
export type RemoteCommand =
  | { command: "play" }
  | { command: "pause" }
  | { command: "seekBack"; intervalSeconds: number }
  | { command: "seekForward"; intervalSeconds: number }
  | { command: "seekTo"; positionSeconds: number; index?: number };

export type AudioPlayerEvents = {
  onStateChange: (snapshot: PlayerSnapshot) => void;
  onRemoteCommand: (command: RemoteCommand) => void;
  onQueueEnded: () => void;
  onError: (payload: { message: string }) => void;
};
