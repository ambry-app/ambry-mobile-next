import TrackPlayer, { isPlaying } from "react-native-track-player";

import { SLEEP_TIMER_FADE_OUT_TIME } from "@/constants";
import { setTriggerTime, useSleepTimer } from "@/stores/sleep-timer";

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;
let onSleepTimerPause: (() => Promise<void>) | null = null;

/**
 * Set the callback for when sleep timer triggers a pause.
 * Called once by the coordinator during initialization.
 *
 * NOTE: Only one callback can be registered.
 */
export function setOnPauseCallback(callback: () => Promise<void>) {
  if (onSleepTimerPause !== null) {
    console.warn("[SleepTimer] Pause callback already registered");
  }
  onSleepTimerPause = callback;
}

/**
 * Start monitoring sleep timer (checks every second).
 * The coordinator calls reset/maybeReset/cancel directly.
 */
export function startMonitoring() {
  if (sleepTimerCheckInterval) return;

  console.debug("[Sleep Timer] Initializing");

  sleepTimerCheckInterval = setInterval(() => {
    checkTimer();
  }, SLEEP_TIMER_CHECK_INTERVAL);
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
    // Call the injected callback to record the pause event
    // NOTE: We don't call cancel() here because that would create a loop
    await onSleepTimerPause?.();
  } else if (timeRemaining <= SLEEP_TIMER_FADE_OUT_TIME) {
    // Fade volume in last 30 seconds
    const volume = timeRemaining / SLEEP_TIMER_FADE_OUT_TIME;
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
  const { sleepTimerEnabled } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return;

  const { playing } = await isPlaying();

  if (!playing) return;

  return reset();
}

/**
 * Start/reset the timer (unconditionally - for use during playback)
 */
export async function reset() {
  const { sleepTimerEnabled, sleepTimer } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return;

  const triggerTime = Date.now() + sleepTimer * 1000;
  console.debug(
    "[Sleep Timer] Setting timer to trigger at",
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

/**
 * Reset service state for testing.
 * Clears intervals and resets callbacks.
 */
export function __resetForTesting() {
  if (sleepTimerCheckInterval) {
    clearInterval(sleepTimerCheckInterval);
    sleepTimerCheckInterval = null;
  }
  onSleepTimerPause = null;
}
