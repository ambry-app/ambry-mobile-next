import { SLEEP_TIMER_FADE_OUT_TIME } from "@/src/constants";
import { useSession } from "@/src/stores/session";
import { setTriggerTime, useSleepTimer } from "@/src/stores/sleep-timer";
import { EventBus } from "@/src/utils";
import TrackPlayer, { isPlaying } from "react-native-track-player";

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring sleep timer (checks every second)
 */
export function startMonitoring() {
  if (sleepTimerCheckInterval) return;

  console.debug("[Sleep Timer] Initializing");

  sleepTimerCheckInterval = setInterval(() => {
    checkTimer();
  }, SLEEP_TIMER_CHECK_INTERVAL);

  EventBus.on("seekApplied", (payload) => {
    if (payload.source === "pause") {
      return;
    }
    maybeReset();
  });

  EventBus.on("playbackStarted", () => {
    reset();
  });

  EventBus.on("playbackPaused", () => {
    cancel();
  });

  EventBus.on("remoteDuck", () => {
    reset();
  });

  EventBus.on("sleepTimerEnabled", () => {
    maybeReset();
  });

  EventBus.on("sleepTimerDisabled", () => {
    cancel();
  });

  EventBus.on("sleepTimerChanged", () => {
    maybeReset();
  });
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
    const session = useSession.getState().session;
    await setTriggerTime(session, null);
    EventBus.emit("playbackPaused", { remote: false });
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
  const session = useSession.getState().session;
  await setTriggerTime(session, triggerTime);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Cancel the timer
 */
export async function cancel() {
  console.debug("[Sleep Timer] Canceling timer");
  const session = useSession.getState().session;
  await setTriggerTime(session, null);
  await TrackPlayer.setVolume(1.0);
}
