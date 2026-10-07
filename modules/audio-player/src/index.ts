/**
 * Audio Player
 *
 * Ambry's own queue player: media3 on Android, AVQueuePlayer +
 * MPRemoteCommandCenter + MPNowPlayingInfoCenter on iOS, both behind this
 * one contract.
 *
 * The native side is deliberately primitive: it plays a flat queue of files
 * and reports track-relative state. Book time, timelines, seek semantics and
 * the event log all live above, in `src/services/track-player-wrapper.ts`.
 *
 * Transport commands from the notification, lock screen and media keys are
 * NOT acted on natively - they arrive as `onRemoteCommand` events with
 * nothing having happened yet. That is the point of this module existing:
 * a lock-screen ±10s must mean the same rate-scaled thing an in-app ±10s
 * means, and pause-rewind must happen at pause time, before the event log
 * sees the pause. Only JS knows how to do either.
 */
import { NativeModule, requireNativeModule } from "expo";

import {
  AudioPlayerEvents,
  NativeTrack,
  PlayerSnapshot,
} from "./AudioPlayer.types";

declare class AudioPlayerNativeModule extends NativeModule<AudioPlayerEvents> {
  setup(): Promise<void>;
  setQueue(tracks: NativeTrack[]): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(index: number, seconds: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  reset(): Promise<void>;
  getState(): Promise<PlayerSnapshot>;
}

let nativeModule: AudioPlayerNativeModule | null = null;

/**
 * Resolved on first use rather than at import, so that importing this module
 * never requires the native one on a platform that does not ship it - jest
 * runs as iOS, and the wrapper is imported by nearly every service test.
 */
export function getAudioPlayer(): AudioPlayerNativeModule {
  nativeModule ??= requireNativeModule<AudioPlayerNativeModule>("AudioPlayer");
  return nativeModule;
}

export * from "./AudioPlayer.types";
