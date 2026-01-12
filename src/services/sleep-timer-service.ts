/**
 * Sleep Timer Service
 *
 * Manages the sleep timer functionality, allowing users to set a timer that
 * will pause playback after a specified duration. Integrates with the track
 * player store to reactively start and stop the timer based on playback state
 * changes and user interactions.
 */

import * as ShakeDetector from "shake-detector";

import {
  MOTION_RESET_DEBOUNCE,
  MOTION_SAMPLE_WINDOW,
  MOTION_VARIANCE_THRESHOLD,
  SLEEP_TIMER_FADE_OUT_TIME,
  SLEEP_TIMER_PAUSE_REWIND_SECONDS,
} from "@/constants";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled as setSleepTimerEnabledDb,
  setSleepTimerTime as setSleepTimerTimeDb,
} from "@/db/settings";
import * as Player from "@/services/track-player-service";
import * as TrackPlayer from "@/services/track-player-wrapper";
import { useDebug } from "@/stores/debug";
import {
  resetForTesting as resetSleepTimerStore,
  setTriggerTime,
  useSleepTimer,
} from "@/stores/sleep-timer";
import {
  PlayPauseEvent,
  PlayPauseSource,
  PlayPauseType,
  Seek,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

const log = logBase.extend("sleep-timer");

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;

let motionListenerSubscription: { remove: () => void } | null = null;

let unsubscribeFunctions: (() => void)[] = [];

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the sleep timer store. Loads user preferences from DB if not
 * already initialized.
 */
export async function initialize(session: Session) {
  if (isInitialized()) {
    log.debug("Already initialized, skipping");
    return;
  }

  const settings = await getSleepTimerSettings(session.email);
  useSleepTimer.setState({
    initialized: true,
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
  });

  setupStoreSubscriptions();

  log.debug("Initialized");
}

/**
 * Sets the enabled state for the sleep timer and persists it to the database.
 * Clears or sets the trigger time as needed.
 */
export async function setSleepTimerEnabled(session: Session, enabled: boolean) {
  log.debug(`Setting enabled to ${enabled}`);

  const { playing } = Player.isPlaying();

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
 * Sets the duration for the sleep timer and persists it to the database. Resets
 * the trigger time if the timer is currently active.
 */
export async function setSleepTimerTime(session: Session, seconds: number) {
  log.debug(`Setting time to ${seconds} seconds`);

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

/**
 * Check if the Sleep Timer store is initialized.
 */
function isInitialized() {
  return useSleepTimer.getState().initialized;
}

/**
 * Subscribes to the track-player store to reactively start and stop the sleep
 * timer based on playback state changes.
 */
function setupStoreSubscriptions() {
  unsubscribeFunctions.push(
    subscribeToChange(
      useTrackPlayer,
      (s) => s.lastPlayPause,
      (event) => event && handlePlayPauseEvent(event),
    ),
  );

  unsubscribeFunctions.push(
    subscribeToChange(
      useTrackPlayer,
      (s) => s.lastSeek,
      (seek) => seek && handleSeek(seek),
    ),
  );

  // Restart motion detection when debug mode changes (if currently running)
  unsubscribeFunctions.push(
    subscribeToChange(
      useDebug,
      (s) => s.debugModeEnabled,
      () => {
        if (motionListenerSubscription) {
          log.debug("Debug mode changed, restarting motion detection");
          stopMotionDetection();
          startMotionDetection();
        }
      },
    ),
  );
}

/**
 * Handle play/pause events. Starts or stops the sleep timer accordingly.
 * Ignores INTERNAL events (e.g., during reload) to avoid unnecessary resets.
 */
function handlePlayPauseEvent(event: PlayPauseEvent) {
  if (event.source === PlayPauseSource.INTERNAL) {
    log.debug("Ignoring INTERNAL play/pause event");
    return;
  }

  if (event.type === PlayPauseType.PLAY) {
    start();
  } else {
    stop();
  }
}

/**
 * Handle seek events. Resets the sleep timer trigger time on user-initiated
 * seeks.
 */
function handleSeek(seek: Seek) {
  if (seek.source !== SeekSource.INTERNAL) {
    // Reset timer on seek
    log.debug(`Detected seek from ${seek.source}`);
    maybeResetTriggerTime();
  }
}

/**
 * Start the sleep timer interval check and sets the trigger time.
 */
async function start() {
  clearTimerInterval();
  stopMotionDetection();
  await resetTriggerTime();

  const { sleepTimerEnabled } = useSleepTimer.getState();

  if (!sleepTimerEnabled) {
    return;
  }

  log.debug("Starting timer check interval");
  sleepTimerCheckInterval = setInterval(checkTimer, SLEEP_TIMER_CHECK_INTERVAL);
  startMotionDetection();
}

/**
 * Stop the sleep timer interval check and clears the trigger time.
 */
async function stop() {
  clearTimerInterval();
  stopMotionDetection();
  await clearTriggerTime();
}

/**
 * Clear the timer check interval.
 */
function clearTimerInterval() {
  if (sleepTimerCheckInterval) {
    clearInterval(sleepTimerCheckInterval);
    sleepTimerCheckInterval = null;
    log.debug("Stopped timer check interval");
  }
}

/**
 * Set/reset the trigger time (if active).
 */
async function maybeResetTriggerTime() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || !sleepTimerTriggerTime) return;

  return resetTriggerTime();
}

/**
 * Set/reset the trigger time based on current time + duration
 */
async function resetTriggerTime() {
  const { sleepTimerEnabled, sleepTimer } = useSleepTimer.getState();

  if (!sleepTimerEnabled) return await clearTriggerTime();

  const triggerTime = Date.now() + sleepTimer * 1000;
  log.debug(`Setting trigger time to ${new Date(triggerTime)}`);
  setTriggerTime(triggerTime);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Clear trigger time
 */
async function clearTriggerTime() {
  log.debug("Clearing trigger time");
  setTriggerTime(null);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Check the sleep timer and take action if needed.
 */
async function checkTimer() {
  const { sleepTimerEnabled, sleepTimerTriggerTime } = useSleepTimer.getState();

  if (!sleepTimerEnabled || sleepTimerTriggerTime === null) {
    // Sanity check - should not happen
    log.warn("checkTimer called but timer not enabled");
    await TrackPlayer.setVolume(1.0);
    return;
  }

  const now = Date.now();
  const timeRemaining = sleepTimerTriggerTime - now;

  if (timeRemaining <= 0) {
    // Time's up - pause and reset
    log.info("Triggering - pausing playback");

    await Player.pause(
      PlayPauseSource.SLEEP_TIMER,
      SLEEP_TIMER_PAUSE_REWIND_SECONDS,
    );
  } else if (timeRemaining <= SLEEP_TIMER_FADE_OUT_TIME) {
    // Fade volume in last 30 seconds
    const volume = timeRemaining / SLEEP_TIMER_FADE_OUT_TIME;
    log.debug(`Fading volume: ${volume.toFixed(2)}`);
    await TrackPlayer.setVolume(volume);
  }
}

// =============================================================================
// Motion Detection
// =============================================================================

/**
 * Start the native shake detector module. When motion is detected (variance
 * exceeds threshold), reset the sleep timer trigger time.
 */
function startMotionDetection() {
  if (motionListenerSubscription) {
    log.debug("Motion detection already started");
    return;
  }

  log.debug("Starting motion detection");

  motionListenerSubscription = ShakeDetector.addMotionListener((event) => {
    // Update variance for debug display (on every reading)
    useSleepTimer.setState({ motionVariance: event.variance });

    // Only process if variance exceeds threshold
    if (event.variance < MOTION_VARIANCE_THRESHOLD) {
      return;
    }

    // Debounce: only reset if enough time has passed since last reset
    const { lastMotionDetected } = useSleepTimer.getState();
    const now = event.timestamp;

    if (
      lastMotionDetected === null ||
      now - lastMotionDetected >= MOTION_RESET_DEBOUNCE
    ) {
      log.debug(`Motion detected (variance: ${event.variance.toFixed(2)})`);
      useSleepTimer.setState({ lastMotionDetected: now });
      maybeResetTriggerTime();
    }
  });

  const { debugModeEnabled } = useDebug.getState();
  ShakeDetector.start(
    MOTION_SAMPLE_WINDOW,
    MOTION_VARIANCE_THRESHOLD,
    debugModeEnabled,
  );
}

/**
 * Stop the native shake detector module and clear motion state.
 */
function stopMotionDetection() {
  if (motionListenerSubscription) {
    motionListenerSubscription.remove();
    motionListenerSubscription = null;
    log.debug("Stopped motion detection");
  }

  ShakeDetector.stop();

  useSleepTimer.setState({
    motionVariance: 0,
  });
}

// =============================================================================
// Testing Helpers
// =============================================================================

/**
 * Reset all module-level state for testing.
 * This cleans up subscriptions and resets state to allow fresh initialization.
 */
export function resetForTesting() {
  // Clear intervals
  if (sleepTimerCheckInterval) {
    clearInterval(sleepTimerCheckInterval);
    sleepTimerCheckInterval = null;
  }

  // Stop motion detection
  if (motionListenerSubscription) {
    motionListenerSubscription.remove();
    motionListenerSubscription = null;
  }
  ShakeDetector.stop();

  // Unsubscribe from all subscriptions
  unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  unsubscribeFunctions = [];

  // Reset store
  resetSleepTimerStore();
}
