/**
 * TrackPlayer Wrapper
 *
 * THE ONLY file that should import from 'react-native-track-player'.
 * All other files should import from this module instead.
 *
 * Benefits:
 * - Single point of control for all native audio calls
 * - Consistent logging for debugging
 * - Easier to mock for testing
 * - Future-proof if we ever swap audio libraries
 */

import type { AddTrack, Progress, Track } from "react-native-track-player";
import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  isPlaying as trackPlayerIsPlaying,
  PitchAlgorithm,
  State,
  TrackType,
  useIsPlaying,
  usePlaybackState,
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
  // Don't log volume changes during fade (too noisy)
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
  return TrackPlayer.getTrack(index);
}

// =============================================================================
// State Queries
// =============================================================================

export async function getProgress(): Promise<Progress> {
  return TrackPlayer.getProgress();
}

export async function getRate(): Promise<number> {
  return TrackPlayer.getRate();
}

export async function isPlaying(): Promise<{
  playing: boolean | undefined;
  bufferingDuringPlay: boolean | undefined;
}> {
  return trackPlayerIsPlaying();
}

// =============================================================================
// Event Listeners (used by playback-service.ts)
// =============================================================================

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  return TrackPlayer.addEventListener(event, handler);
}

// =============================================================================
// Setup (called once at boot)
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

// =============================================================================
// Re-exports: Types and Enums
// =============================================================================

export {
  // Enums
  AndroidAudioContentType,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  PitchAlgorithm,
  State,
  TrackType,
  // React hooks (for UI components)
  useIsPlaying,
  usePlaybackState,
};

// Re-export types
export type { AddTrack, Progress, Track };
