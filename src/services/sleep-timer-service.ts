import {
  SLEEP_TIMER_FADE_OUT_TIME,
  SLEEP_TIMER_PAUSE_REWIND_SECONDS,
} from "@/constants";
import { recordPauseEvent } from "@/services/event-recording";
import * as Heartbeat from "@/services/position-heartbeat";
import * as Player from "@/services/trackplayer-wrapper";
import { usePlayerUIState } from "@/stores/player-ui-state";
import { setTriggerTime, useSleepTimer } from "@/stores/sleep-timer";

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;
let unsubscribeFromStore: (() => void) | null = null;

/**
 * Start monitoring sleep timer (checks every second).
 * The service now subscribes to store changes to react to settings updates.
 */
export function startMonitoring() {
  if (sleepTimerCheckInterval) return;

  console.debug("[Sleep Timer] Initializing");

  sleepTimerCheckInterval = setInterval(() => {
    checkTimer();
  }, SLEEP_TIMER_CHECK_INTERVAL);

  // Subscribe to store changes to react to settings updates
  unsubscribeFromStore = useSleepTimer.subscribe((state, prevState) => {
    // When timer is enabled
    if (state.sleepTimerEnabled && !prevState.sleepTimerEnabled) {
      maybeReset();
    }
    // When timer is disabled
    else if (!state.sleepTimerEnabled && prevState.sleepTimerEnabled) {
      cancel();
    }
    // When duration changes while timer is active
    else if (
      state.sleepTimer !== prevState.sleepTimer &&
      state.sleepTimerTriggerTime !== null
    ) {
      maybeReset();
    }
  });
}

/**
 * Check if sleep timer should trigger
 */
async function checkTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime === null) {
    await Player.setVolume(1.0);
    return;
  }

  const now = Date.now();
  const timeRemaining = sleepTimerTriggerTime - now;

  if (timeRemaining <= 0) {
    // Time's up - pause and reset
    console.debug("[Sleep Timer] Triggering - pausing playback");

    const { loadedPlaythrough, playbackRate } = usePlayerUIState.getState();
    if (!loadedPlaythrough) {
      // Player not loaded, just cancel timer
      cancel();
      return;
    }

    // Stop heartbeat before pausing
    Heartbeat.stop();

    await Player.pause();
    await Player.setVolume(1.0);

    // Rewind so the user has context when they resume the next day
    // (see SLEEP_TIMER_PAUSE_REWIND_SECONDS in constants.ts for explanation)
    const { position, duration } = await Player.getProgress();
    let seekPosition =
      position - SLEEP_TIMER_PAUSE_REWIND_SECONDS * playbackRate;
    seekPosition = Math.max(0, Math.min(seekPosition, duration));
    await Player.seekTo(seekPosition);

    setTriggerTime(null);

    // Record the pause event directly instead of using a callback
    await recordPauseEvent(
      loadedPlaythrough.playthroughId,
      seekPosition, // Record with the new, rewound position
      playbackRate,
    );
  } else if (timeRemaining <= SLEEP_TIMER_FADE_OUT_TIME) {
    // Fade volume in last 30 seconds
    const volume = timeRemaining / SLEEP_TIMER_FADE_OUT_TIME;
    console.debug("[Sleep Timer] Fading volume:", volume.toFixed(2));
    await Player.setVolume(volume);
  } else {
    // Normal playback
    await Player.setVolume(1.0);
  }
}

/**
 * Start/reset the timer (only if currently playing)
 */
export async function maybeReset() {
  const { sleepTimerEnabled } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return;

  const { playing } = await Player.isPlaying();

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
  await Player.setVolume(1.0);
}

/**
 * Cancel the timer
 */
export async function cancel() {
  console.debug("[Sleep Timer] Canceling timer");
  setTriggerTime(null);
  await Player.setVolume(1.0);
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
  unsubscribeFromStore?.();
  unsubscribeFromStore = null;
}
