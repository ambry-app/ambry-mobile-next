/**
 * The player vocabulary the services speak, inherited from
 * react-native-track-player. RNTP itself is gone; these are the shapes the
 * services were written against, vendored with RNTP's string values so the
 * dependency could be deleted without touching every service. Collapsing
 * them into the native module's own vocabulary is the seam-simplification
 * pass, deliberately separate.
 */

export enum Event {
  PlayerError = "player-error",
  PlaybackState = "playback-state",
  PlaybackError = "playback-error",
  PlaybackQueueEnded = "playback-queue-ended",
  PlaybackActiveTrackChanged = "playback-active-track-changed",
  PlaybackPlayWhenReadyChanged = "playback-play-when-ready-changed",
  PlaybackProgressUpdated = "playback-progress-updated",
  PlaybackResume = "android-playback-resume",
  RemotePlay = "remote-play",
  RemotePause = "remote-pause",
  RemoteStop = "remote-stop",
  RemoteNext = "remote-next",
  RemotePrevious = "remote-previous",
  RemoteJumpForward = "remote-jump-forward",
  RemoteJumpBackward = "remote-jump-backward",
  RemoteSeek = "remote-seek",
  RemoteDuck = "remote-duck",
  RemoteLike = "remote-like",
  RemoteDislike = "remote-dislike",
  RemoteBookmark = "remote-bookmark",
  MetadataChapterReceived = "metadata-chapter-received",
  MetadataTimedReceived = "metadata-timed-received",
  MetadataCommonReceived = "metadata-common-received",
  AndroidConnectorConnected = "android-controller-connected",
  AndroidConnectorDisconnected = "android-controller-disconnected",
}

export enum State {
  None = "none",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Stopped = "stopped",
  Loading = "loading",
  Buffering = "buffering",
  Error = "error",
  Ended = "ended",
}

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
  description?: string;
  duration?: number;
  headers?: Record<string, string>;
}

export type AddTrack = Track;

export interface Progress {
  position: number;
  duration: number;
  buffered: number;
}

export type PlaybackState = { state: State };
