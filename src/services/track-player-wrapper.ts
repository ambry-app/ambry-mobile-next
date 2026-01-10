/**
 * Track Player Wrapper
 *
 * One of the only files that should import from 'react-native-track-player'.
 * The other is `src/types/track-player.ts`. All other files should import from
 * either of these files instead of directly from 'react-native-track-player'.
 */

import type {
  AddTrack,
  PlaybackState,
  Progress,
} from "react-native-track-player";
import TrackPlayer, { Event } from "react-native-track-player";

import { logBase } from "@/utils/logger";

const log = logBase.extend("track-player-wrapper");

// =============================================================================
// Playback Control
// =============================================================================

export async function play() {
  log.trace("play");
  return TrackPlayer.play();
}

export async function pause() {
  log.trace("pause");
  return TrackPlayer.pause();
}

export async function seekTo(position: number) {
  log.trace(`seekTo ${position.toFixed(1)}`);
  return TrackPlayer.seekTo(position);
}

export async function setRate(rate: number) {
  log.trace(`setRate ${rate}`);
  return TrackPlayer.setRate(rate);
}

export async function setVolume(volume: number) {
  log.trace(`setVolume ${volume}`);
  return TrackPlayer.setVolume(volume);
}

// =============================================================================
// Queue Management
// =============================================================================

export async function reset() {
  log.trace("reset");
  return TrackPlayer.reset();
}

export async function add(track: AddTrack) {
  log.trace(`add ${track.title}`);
  return TrackPlayer.add(track);
}

// =============================================================================
// State Queries
// =============================================================================

export async function getProgress(): Promise<Progress> {
  log.trace("getProgress");
  return TrackPlayer.getProgress();
}

export async function getRate(): Promise<number> {
  log.trace("getRate");
  return TrackPlayer.getRate();
}

export async function getPlaybackState(): Promise<PlaybackState> {
  log.trace("getPlaybackState");
  return TrackPlayer.getPlaybackState();
}

export async function getPlayWhenReady(): Promise<boolean> {
  log.trace("getPlayWhenReady");
  return TrackPlayer.getPlayWhenReady();
}

// =============================================================================
// Event Listeners
// =============================================================================

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  log.trace(`addEventListener ${event}`);
  return TrackPlayer.addEventListener(event, handler);
}

// =============================================================================
// Setup
// =============================================================================

export async function setupPlayer(
  options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) {
  log.trace("setupPlayer");
  return TrackPlayer.setupPlayer(options);
}

export async function updateOptions(
  options: Parameters<typeof TrackPlayer.updateOptions>[0],
) {
  log.trace("updateOptions");
  return TrackPlayer.updateOptions(options);
}

export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  log.trace("registerPlaybackService");
  TrackPlayer.registerPlaybackService(factory);
}
