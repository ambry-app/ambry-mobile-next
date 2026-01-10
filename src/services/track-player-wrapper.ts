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

// =============================================================================
// Playback Control
// =============================================================================

export async function play() {
  console.debug("[TrackPlayer] play");
  return TrackPlayer.play();
}

export async function pause() {
  console.debug("[TrackPlayer] pause");
  return TrackPlayer.pause();
}

export async function seekTo(position: number) {
  console.debug("[TrackPlayer] seekTo", position.toFixed(1));
  return TrackPlayer.seekTo(position);
}

export async function setRate(rate: number) {
  console.debug("[TrackPlayer] setRate", rate);
  return TrackPlayer.setRate(rate);
}

export async function setVolume(volume: number) {
  console.debug("[TrackPlayer] setVolume", volume);
  return TrackPlayer.setVolume(volume);
}

// =============================================================================
// Queue Management
// =============================================================================

export async function reset() {
  console.debug("[TrackPlayer] reset");
  return TrackPlayer.reset();
}

export async function add(track: AddTrack) {
  console.debug("[TrackPlayer] add", track.title);
  return TrackPlayer.add(track);
}

export async function getTrack(index: number): Promise<Track | undefined> {
  console.debug("[TrackPlayer] getTrack", index);
  return TrackPlayer.getTrack(index);
}

// =============================================================================
// State Queries
// =============================================================================

export async function getProgress(): Promise<Progress> {
  // This one is too noisy due to constant position polling while playing
  // console.debug("[TrackPlayer] getProgress");
  return TrackPlayer.getProgress();
}

export async function getRate(): Promise<number> {
  console.debug("[TrackPlayer] getRate");
  return TrackPlayer.getRate();
}

export async function isPlaying(): Promise<{
  playing: boolean | undefined;
  bufferingDuringPlay: boolean | undefined;
}> {
  console.debug("[TrackPlayer] isPlaying");
  return trackPlayerIsPlaying();
}

export async function getPlaybackState(): Promise<PlaybackState> {
  console.debug("[TrackPlayer] getPlaybackState");
  return TrackPlayer.getPlaybackState();
}

export async function getPlayWhenReady(): Promise<boolean> {
  console.debug("[TrackPlayer] getPlayWhenReady");
  return TrackPlayer.getPlayWhenReady();
}

export async function getActiveTrack(): Promise<Track | undefined> {
  console.debug("[TrackPlayer] getActiveTrack");
  return TrackPlayer.getActiveTrack();
}

// =============================================================================
// Event Listeners
// =============================================================================

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  console.debug("[TrackPlayer] addEventListener", event);
  return TrackPlayer.addEventListener(event, handler);
}

// =============================================================================
// Setup
// =============================================================================

export async function setupPlayer(
  options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) {
  console.debug("[TrackPlayer] setupPlayer");
  return TrackPlayer.setupPlayer(options);
}

export async function updateOptions(
  options: Parameters<typeof TrackPlayer.updateOptions>[0],
) {
  console.debug("[TrackPlayer] updateOptions");
  return TrackPlayer.updateOptions(options);
}

export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  console.debug("[TrackPlayer] registerPlaybackService");
  TrackPlayer.registerPlaybackService(factory);
}
