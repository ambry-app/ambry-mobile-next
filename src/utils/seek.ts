import {
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/constants";
import * as Coordinator from "@/services/playback-coordinator";
import * as Player from "@/services/trackplayer-wrapper";
import { SeekSource } from "@/stores/player";

/**
 * Seeking functions for the TrackPlayer background service.
 *
 * WHY THIS EXISTS SEPARATELY FROM player.ts:
 * The playback-service.ts runs in the TrackPlayer foreground service context
 * and handles remote control events (headphones, lock screen, car controls).
 * These events fire even when the React component tree isn't mounted.
 *
 * player.ts uses Zustand state for seek accumulation, but that state is tied
 * to React's lifecycle. This module uses plain module-level variables so it
 * works reliably regardless of React's state.
 *
 * Both implementations share the same accumulation logic and timing constants
 * (SEEK_ACCUMULATION_WINDOW, SEEK_EVENT_ACCUMULATION_WINDOW) and both notify
 * the coordinator, but they manage their internal state differently.
 */

let isSeeking = false;
let seekAccumulator: number | null = null;
let seekBasePosition: number | null = null;
let seekTimer: NodeJS.Timeout | null = null;
let seekEventTimer: NodeJS.Timeout | null = null;
let playbackRate: number | null = null;
let duration: number | null = null;
let seekEventFrom: number | null = null;
let seekEventTo: number | null = null;
let seekEventTimestamp: Date | null = null;

export async function seek(interval: number) {
  if (isSeeking) return;

  if (!seekTimer || !seekEventTimer) {
    const { position, duration: trackDuration } = await Player.getProgress();

    // First tap for short timer
    if (!seekTimer) {
      playbackRate = await Player.getRate();
      seekBasePosition = position;
      seekAccumulator = 0;
      duration = trackDuration;
    }

    // First tap for long timer
    if (!seekEventTimer) {
      seekEventFrom = position;
    }
  }

  // Each tap
  if (seekAccumulator == null) {
    throw new Error("Seek state invalid");
  }

  seekAccumulator += interval;

  if (seekTimer) clearTimeout(seekTimer);
  if (seekEventTimer) clearTimeout(seekEventTimer);

  // On short delay, apply the seek
  seekTimer = setTimeout(async () => {
    isSeeking = true;
    seekTimer = null;

    if (
      seekBasePosition == null ||
      seekAccumulator == null ||
      playbackRate == null ||
      duration == null
    ) {
      throw new Error("Seek state invalid");
    }

    let newPosition = seekBasePosition + seekAccumulator * playbackRate;
    newPosition = Math.max(0, Math.min(newPosition, duration));

    console.debug(
      "[TrackPlayer Service] Seeking from",
      seekBasePosition,
      "to",
      newPosition,
    );

    await Player.seekTo(newPosition);
    seekEventTimestamp = new Date();
    Coordinator.onSeekApplied({
      position: newPosition,
      duration,
      userInitiated: true,
      source: SeekSource.REMOTE,
    });

    seekAccumulator = 0;
    isSeeking = false;
    seekEventTo = newPosition;
  }, SEEK_ACCUMULATION_WINDOW);

  // On longer delay, emit debounced seek event for recording
  seekEventTimer = setTimeout(() => {
    seekEventTimer = null;

    if (
      seekEventFrom == null ||
      seekEventTo == null ||
      seekEventTimestamp == null
    ) {
      throw new Error("Seek event state invalid");
    }

    console.debug(
      "[TrackPlayer Service] Debounced seek from",
      seekEventFrom,
      "to",
      seekEventTo,
    );

    Coordinator.onSeekCompleted({
      fromPosition: seekEventFrom,
      toPosition: seekEventTo,
      timestamp: seekEventTimestamp,
    });

    seekEventFrom = null;
    seekEventTo = null;
    seekEventTimestamp = null;
  }, SEEK_EVENT_ACCUMULATION_WINDOW);
}

export async function seekImmediateNoLog(interval: number) {
  if (isSeeking) return;

  isSeeking = true;

  const { position, duration } = await Player.getProgress();
  const playbackRate = await Player.getRate();

  let seekPosition = position + interval * playbackRate;
  seekPosition = Math.max(0, Math.min(seekPosition, duration));

  console.debug(
    "[TrackPlayer Service] Seeking from",
    position,
    "to",
    seekPosition,
    "without logging",
  );

  await Player.seekTo(seekPosition);
  Coordinator.onSeekApplied({
    position: seekPosition,
    duration,
    userInitiated: false,
    source: SeekSource.PAUSE,
  });
  isSeeking = false;
}
