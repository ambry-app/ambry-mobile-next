import { setTriggerTime, useSleepTimer } from "@/src/stores/sleep-timer";
import { EventBus } from "@/src/utils";
import TrackPlayer from "react-native-track-player";

const FADE_OUT_TIME = 30000; // 30 seconds in milliseconds
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring sleep timer (checks every second)
 */
export function startMonitoring() {
  if (sleepTimerCheckInterval) return;

  console.debug("[Sleep Timer] Starting monitoring");
  sleepTimerCheckInterval = setInterval(() => {
    checkTimer();
  }, 1000);
}

/**
 * Check if sleep timer should trigger
 */
async function checkTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime === null) {
    await TrackPlayer.setVolume(1.0);
    return;
  }

  const now = Date.now();
  const timeRemaining = sleepTimerTriggerTime - now;

  if (timeRemaining <= 0) {
    // Time's up - pause and reset
    console.debug("[Sleep Timer] Triggering - pausing playback");
    await TrackPlayer.pause();
    await TrackPlayer.setVolume(1.0);
    setTriggerTime(null);
    EventBus.emit("playbackPaused", { remote: false });
  } else if (timeRemaining <= FADE_OUT_TIME) {
    // Fade volume in last 30 seconds
    const volume = timeRemaining / FADE_OUT_TIME;
    console.debug("[Sleep Timer] Fading volume:", volume.toFixed(2));
    await TrackPlayer.setVolume(volume);
  } else {
    // Normal playback
    await TrackPlayer.setVolume(1.0);
  }
}

/**
 * Start/reset the timer (only if currently playing)
 */
export async function maybeReset() {
  const { sleepTimerEnabled, sleepTimer } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return;

  // Only set trigger time if playing
  const state = await TrackPlayer.getPlaybackState();
  if (state.state !== "playing") return;

  const triggerTime = Date.now() + sleepTimer * 1000;
  console.debug(
    "[Sleep Timer] Resetting timer to trigger at",
    new Date(triggerTime),
  );
  setTriggerTime(triggerTime);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Start/reset the timer (unconditionally - for use during playback)
 */
export async function reset() {
  const { sleepTimerEnabled, sleepTimer } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return;

  const triggerTime = Date.now() + sleepTimer * 1000;
  console.debug(
    "[Sleep Timer] Resetting timer to trigger at",
    new Date(triggerTime),
  );
  setTriggerTime(triggerTime);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Cancel the timer
 */
export async function cancel() {
  console.debug("[Sleep Timer] Canceling timer");
  setTriggerTime(null);
  await TrackPlayer.setVolume(1.0);
}
