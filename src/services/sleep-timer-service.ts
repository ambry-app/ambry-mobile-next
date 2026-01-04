import {
  SLEEP_TIMER_FADE_OUT_TIME,
  SLEEP_TIMER_PAUSE_REWIND_SECONDS,
} from "@/constants";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled as setSleepTimerEnabledDb,
  setSleepTimerTime as setSleepTimerTimeDb,
} from "@/db/settings";
import * as Player from "@/services/trackplayer-wrapper";
import { usePlayerUIState } from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";
import { setTriggerTime, useSleepTimer } from "@/stores/sleep-timer";
import { Session } from "@/types/session";

import * as EventRecording from "./event-recording";
import * as Heartbeat from "./position-heartbeat";
import { seekImmediateNoLog } from "./seek-service";
import { syncPlaythroughs } from "./sync-service";

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the sleep timer store.
 * Loads user preferences from DB if not already initialized.
 */
export async function initialize(session: Session) {
  if (useSleepTimer.getState().initialized) {
    console.debug("[SleepTimer] Already initialized, skipping");
    return;
  }
  console.debug("[SleepTimer] Initializing");
  const settings = await getSleepTimerSettings(session.email);
  useSleepTimer.setState({
    initialized: true,
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
  });
}

/**
 * Start the sleep timer interval check and sets the trigger time.
 */
export async function start() {
  clearTimerInterval();
  await resetTriggerTime();

  console.debug("[SleepTimer] Starting timer check interval");
  sleepTimerCheckInterval = setInterval(checkTimer, SLEEP_TIMER_CHECK_INTERVAL);
}

/**
 * Stop the sleep timer interval check and clears the trigger time.
 */
export async function stop() {
  clearTimerInterval();
  await clearTriggerTime();
}

function clearTimerInterval() {
  if (sleepTimerCheckInterval) {
    clearInterval(sleepTimerCheckInterval);
    sleepTimerCheckInterval = null;
    console.debug("[SleepTimer] Stopped timer check interval");
  }
}

/**
 * Set/reset the trigger time (if active).
 */
export async function maybeResetTriggerTime() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || !sleepTimerTriggerTime) return;

  return resetTriggerTime();
}

/**
 * Sets the enabled state for the sleep timer and persists it to the database.
 * Clears or sets the trigger time as needed.
 */
export async function setSleepTimerEnabled(session: Session, enabled: boolean) {
  console.debug("[SleepTimer] Setting enabled to", enabled);
  const { playing } = await Player.isPlaying();

  useSleepTimer.setState({
    sleepTimerEnabled: enabled,
    sleepTimerTriggerTime: null,
  });

  if (playing) {
    if (enabled) {
      await start();
    } else {
      await stop();
    }
  }

  await setSleepTimerEnabledDb(session.email, enabled);
}

/**
 * Sets the duration for the sleep timer and persists it to the database.
 * Resets the trigger time if the timer is currently active.
 */
export async function setSleepTimerTime(session: Session, seconds: number) {
  console.debug("[SleepTimer] Setting time to", seconds, "seconds");

  const { sleepTimerTriggerTime, sleepTimer: prevSleepTimer } =
    useSleepTimer.getState();

  useSleepTimer.setState({ sleepTimer: seconds });

  if (sleepTimerTriggerTime !== null && prevSleepTimer !== seconds) {
    await maybeResetTriggerTime();
  }
  await setSleepTimerTimeDb(session.email, seconds);
}

// =============================================================================
// Internals
// =============================================================================

async function checkTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime === null) {
    // Sanity check - should not happen
    console.warn("[SleepTimer] checkTimer called but timer not enabled");
    await Player.setVolume(1.0);
    return;
  }

  const now = Date.now();
  const timeRemaining = sleepTimerTriggerTime - now;

  if (timeRemaining <= 0) {
    // Time's up - pause and reset
    console.debug("[SleepTimer] Triggering - pausing playback");

    // We have to re-implement most of the pause logic from player-controls here
    await Player.pause();
    await seekImmediateNoLog(-SLEEP_TIMER_PAUSE_REWIND_SECONDS);

    Heartbeat.stop();
    stop();

    const { loadedPlaythrough, playbackRate } = usePlayerUIState.getState();
    if (loadedPlaythrough) {
      const { position } = await Player.getProgress();
      EventRecording.recordPauseEvent(
        loadedPlaythrough.playthroughId,
        position,
        playbackRate,
      );
    }

    const session = useSession.getState().session;
    if (session) {
      syncPlaythroughs(session);
    }
  } else if (timeRemaining <= SLEEP_TIMER_FADE_OUT_TIME) {
    // Fade volume in last 30 seconds
    const volume = timeRemaining / SLEEP_TIMER_FADE_OUT_TIME;
    console.debug("[SleepTimer] Fading volume:", volume.toFixed(2));
    await Player.setVolume(volume);
  }
}

/**
 * Set/reset the trigger time based on current time + duration
 */
async function resetTriggerTime() {
  const { sleepTimerEnabled, sleepTimer } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return await clearTriggerTime();

  const triggerTime = Date.now() + sleepTimer * 1000;
  console.debug("[SleepTimer] Setting trigger time to", new Date(triggerTime));
  setTriggerTime(triggerTime);
  await Player.setVolume(1.0);
}

/**
 * Clear trigger time
 */
async function clearTriggerTime() {
  console.debug("[SleepTimer] Clearing trigger time");
  setTriggerTime(null);
  await Player.setVolume(1.0);
}
