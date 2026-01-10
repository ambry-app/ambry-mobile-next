/**
 * TrackPlayer Wrapper
 *
 * One of the only files that should import from 'react-native-track-player'.
 * The other is `src/types/track-player.ts`. All other files should import from
 * this module instead.
 *
 * Benefits:
 * - Single point of control for all native audio calls
 * - Consistent logging for debugging
 * - Easier to mock for testing
 * - Future-proof if we ever swap audio libraries
 */

import type {
  AddTrack,
  PlaybackState,
  Progress,
  Track,
} from "react-native-track-player";
import TrackPlayer, {
  Event,
  isPlaying as trackPlayerIsPlaying,
} from "react-native-track-player";

import { logBase } from "@/utils/logger";

const log = logBase.extend("track-player-wrapper");

// =============================================================================
// Playback Control
// =============================================================================

export async function play() {
  log.debug("play");
  return TrackPlayer.play();
}

export async function pause() {
  log.debug("pause");
  return TrackPlayer.pause();
}

export async function seekTo(position: number) {
  log.debug(`seekTo ${position.toFixed(1)}`);
  return TrackPlayer.seekTo(position);
}

export async function setRate(rate: number) {
  log.debug(`setRate ${rate}`);
  return TrackPlayer.setRate(rate);
}

export async function setVolume(volume: number) {
  log.debug(`setVolume ${volume}`);
  return TrackPlayer.setVolume(volume);
}

// =============================================================================
// Queue Management
// =============================================================================

export async function reset() {
  log.debug("reset");
  return TrackPlayer.reset();
}

export async function add(track: AddTrack) {
  log.debug(`add ${track.title}`);
  return TrackPlayer.add(track);
}

export async function getTrack(index: number): Promise<Track | undefined> {
  log.debug(`getTrack ${index}`);
  return TrackPlayer.getTrack(index);
}

// =============================================================================
// State Queries
// =============================================================================

export async function getProgress(): Promise<Progress> {
  log.trace("getProgress");
  return TrackPlayer.getProgress();
}

export async function getRate(): Promise<number> {
  log.debug("getRate");
  return TrackPlayer.getRate();
}

export async function isPlaying(): Promise<{
  playing: boolean | undefined;
  bufferingDuringPlay: boolean | undefined;
}> {
  log.debug("isPlaying");
  return trackPlayerIsPlaying();
}

export async function getPlaybackState(): Promise<PlaybackState> {
  log.debug("getPlaybackState");
  return TrackPlayer.getPlaybackState();
}

export async function getPlayWhenReady(): Promise<boolean> {
  log.debug("getPlayWhenReady");
  return TrackPlayer.getPlayWhenReady();
}

export async function getActiveTrack(): Promise<Track | undefined> {
  log.debug("getActiveTrack");
  return TrackPlayer.getActiveTrack();
}

// =============================================================================
// Event Listeners
// =============================================================================

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  log.debug(`addEventListener ${event}`);
  return TrackPlayer.addEventListener(event, handler);
}

// =============================================================================
// Setup
// =============================================================================

export async function setupPlayer(
  options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) {
  log.debug("setupPlayer");
  return TrackPlayer.setupPlayer(options);
}

export async function updateOptions(
  options: Parameters<typeof TrackPlayer.updateOptions>[0],
) {
  log.debug("updateOptions");
  return TrackPlayer.updateOptions(options);
}

export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  log.debug("registerPlaybackService");
  TrackPlayer.registerPlaybackService(factory);
}
