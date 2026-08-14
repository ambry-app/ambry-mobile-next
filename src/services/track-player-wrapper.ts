/**
 * Track Player Wrapper
 *
 * One of the only files that should import from 'react-native-track-player'.
 * The other is `src/types/track-player.ts`. All other files should import from
 * either of these files instead of directly from 'react-native-track-player'.
 *
 * It is also where a recording's files stop being visible. A direct-play
 * recording can be one file or forty, but the player above this line only ever
 * sees one continuous book: `getProgress` reports book seconds and the book's
 * whole duration, and `seekTo` takes book seconds. Callers cannot observe a
 * track index because none is exposed, which is what keeps multi-file out of
 * the UI, the chapter logic and the event log by construction rather than by
 * everyone remembering to convert.
 */

import type {
  AddTrack,
  PlaybackState,
  Progress,
} from "react-native-track-player";
import TrackPlayer, { Event } from "react-native-track-player";

import { logBase } from "@/utils/logger";
import {
  bookDuration,
  bookPositionOf,
  type TimelineTrack,
  trackAt,
} from "@/utils/playback-timeline";

const log = logBase.extend("track-player-wrapper");

// The files behind the currently loaded recording, in playback order. Empty
// for legacy media, whose single stream is already the whole book, so the
// translation below collapses to a pass-through.
let timeline: TimelineTrack[] = [];

// =============================================================================
// Playback Control
// =============================================================================

export async function play() {
  log.silly("play");
  return TrackPlayer.play();
}

export async function pause() {
  log.silly("pause");
  return TrackPlayer.pause();
}

/**
 * Seek to a position in book seconds.
 *
 * Crossing into another file is a skip rather than a seek, which is why this
 * cannot just forward to the player. `skip` takes the position to start at, so
 * the move happens in one call and never lands at the head of a file first.
 */
export async function seekTo(position: number) {
  log.silly(`seekTo ${position.toFixed(1)}`);

  if (timeline.length <= 1) {
    return TrackPlayer.seekTo(position);
  }

  const target = trackAt(timeline, position);
  const activeIndex = await TrackPlayer.getActiveTrackIndex();

  if (activeIndex === target.index) {
    return TrackPlayer.seekTo(target.position);
  }

  log.debug(
    `seek crosses into file ${target.index} at ${target.position.toFixed(1)}`,
  );
  return TrackPlayer.skip(target.index, target.position);
}

export async function setRate(rate: number) {
  log.silly(`setRate ${rate}`);
  return TrackPlayer.setRate(rate);
}

export async function setVolume(volume: number) {
  log.silly(`setVolume ${volume}`);
  return TrackPlayer.setVolume(volume);
}

// =============================================================================
// Queue Management
// =============================================================================

export async function reset() {
  log.silly("reset");
  timeline = [];
  return TrackPlayer.reset();
}

/**
 * Load a recording's files as the player's queue.
 *
 * `tracks` describes where each file sits on the book's timeline. Pass an empty
 * array for legacy media, whose single stream already is the whole book.
 */
export async function add(tracks: AddTrack[], timelineTracks: TimelineTrack[]) {
  log.silly(`add ${tracks.length} file(s)`);
  timeline = timelineTracks;
  return TrackPlayer.add(tracks);
}

// =============================================================================
// State Queries
// =============================================================================

/**
 * Progress in book seconds, against the book's whole duration.
 *
 * The player reports where it is in the file it is playing. On a multi-file
 * recording that is neither the position the reader is at nor the length of
 * what they are listening to, so both are translated here.
 *
 * `buffered` is left as the player reports it: it describes the file being
 * streamed, and there is no meaningful book-wide equivalent.
 */
export async function getProgress(): Promise<Progress> {
  log.silly("getProgress");

  const progress = await TrackPlayer.getProgress();

  if (timeline.length <= 1) return progress;

  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined) return progress;

  return {
    ...progress,
    position: bookPositionOf(timeline, activeIndex, progress.position),
    duration: bookDuration(timeline),
  };
}

export async function getRate(): Promise<number> {
  log.silly("getRate");
  return TrackPlayer.getRate();
}

export async function getPlaybackState(): Promise<PlaybackState> {
  log.silly("getPlaybackState");
  return TrackPlayer.getPlaybackState();
}

export async function getPlayWhenReady(): Promise<boolean> {
  log.silly("getPlayWhenReady");
  return TrackPlayer.getPlayWhenReady();
}

// =============================================================================
// Event Listeners
// =============================================================================

export function addEventListener<T extends Event>(
  event: T,
  handler: Parameters<typeof TrackPlayer.addEventListener<T>>[1],
) {
  log.silly(`addEventListener ${event}`);
  return TrackPlayer.addEventListener(event, handler);
}

// =============================================================================
// Setup
// =============================================================================

export async function setupPlayer(
  options: Parameters<typeof TrackPlayer.setupPlayer>[0],
) {
  log.silly("setupPlayer");
  return TrackPlayer.setupPlayer(options);
}

export async function updateOptions(
  options: Parameters<typeof TrackPlayer.updateOptions>[0],
) {
  log.silly("updateOptions");
  return TrackPlayer.updateOptions(options);
}

export function registerPlaybackService(
  factory: () => () => Promise<void>,
): void {
  log.silly("registerPlaybackService");
  TrackPlayer.registerPlaybackService(factory);
}
