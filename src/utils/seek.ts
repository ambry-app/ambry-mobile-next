import {
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/src/constants";
import TrackPlayer from "react-native-track-player";
import { EventBus } from "./event-bus";

// Seeking functions for use by the TrackPlayer service. These do not interact
// with the zustand store in any way, and are only meant for use by the
// TrackPlayer service.

let isSeeking = false;
let seekAccumulator: number | null = null;
let seekBasePosition: number | null = null;
let seekTimer: NodeJS.Timeout | null = null;
let seekEventTimer: NodeJS.Timeout | null = null;
let playbackRate: number | null = null;
let duration: number | null = null;
let seekEventFrom: number | null = null;
let seekEventTo: number | null = null;

export async function seek(interval: number) {
  if (isSeeking) return;

  if (!seekTimer || !seekEventTimer) {
    const { position, duration: trackDuration } =
      await TrackPlayer.getProgress();

    // First tap for short timer
    if (!seekTimer) {
      playbackRate = await TrackPlayer.getRate();
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

    await TrackPlayer.seekTo(newPosition);
    EventBus.emit("seekApplied", {
      position: newPosition,
      duration,
      userInitiated: true,
    });

    seekAccumulator = 0;
    isSeeking = false;
    seekEventTo = newPosition;
  }, SEEK_ACCUMULATION_WINDOW);

  // On longer delay, save the seek event to the database
  seekEventTimer = setTimeout(() => {
    seekEventTimer = null;

    if (seekEventFrom == null || seekEventTo == null) {
      throw new Error("Seek event state invalid");
    }

    console.debug(
      "[TrackPlayer Service] Seek event from",
      seekEventFrom,
      "to",
      seekEventTo,
    );
    // TODO: Save the seek event to the database
    // NOTE: ignore events if they're not "meaningful"

    seekEventFrom = null;
    seekEventTo = null;
  }, SEEK_EVENT_ACCUMULATION_WINDOW);
}

export async function seekImmediateNoLog(interval: number) {
  if (isSeeking) return;

  isSeeking = true;

  const { position, duration } = await TrackPlayer.getProgress();
  const playbackRate = await TrackPlayer.getRate();

  let seekPosition = position + interval * playbackRate;
  seekPosition = Math.max(0, Math.min(seekPosition, duration));

  console.debug(
    "[TrackPlayer Service] Seeking from",
    position,
    "to",
    seekPosition,
    "without logging",
  );

  await TrackPlayer.seekTo(seekPosition);
  EventBus.emit("seekApplied", {
    position: seekPosition,
    duration,
    userInitiated: false,
  });
  isSeeking = false;
}
