/**
 * Sleep Timer Service
 *
 * Manages the sleep timer functionality, allowing users to set a timer that
 * will pause playback after a specified duration. When motion detection is
 * enabled, the timer only runs when the user is stationary - if they're
 * moving around, the timer pauses (since they're clearly still awake).
 *
 * Architecture:
 * - All state changes flow through `updateTimerState()` which evaluates conditions
 *   and starts/stops the timer check and activity tracking as needed
 * - Timer runs when: playing && enabled && (!motionDetection || stationary)
 * - Activity tracking runs when: playing && enabled && motionDetection
 */

import * as ActivityTracker from "activity-tracker";

import {
  SLEEP_TIMER_FADE_OUT_TIME,
  SLEEP_TIMER_PAUSE_REWIND_SECONDS,
} from "@/constants";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled as setSleepTimerEnabledDb,
  setSleepTimerMotionDetectionEnabled as setSleepTimerMotionDetectionEnabledDb,
  setSleepTimerTime as setSleepTimerTimeDb,
} from "@/db/settings";
import { pause } from "@/services/track-player-service";
import * as TrackPlayer from "@/services/track-player-wrapper";
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

// =============================================================================
// Module State
// =============================================================================

const TIMER_CHECK_INTERVAL_MS = 1000;

/** Interval that periodically checks if timer should trigger */
let timerCheckInterval: NodeJS.Timeout | null = null;

/** Subscription to activity state changes from native module */
let activitySubscription: { remove: () => void } | null = null;

/** Store subscriptions for cleanup */
let storeSubscriptions: (() => void)[] = [];

// =============================================================================
// State Helpers
// =============================================================================

function isTimerCheckRunning(): boolean {
  return timerCheckInterval !== null;
}

function isActivityTrackingActive(): boolean {
  return activitySubscription !== null;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the sleep timer service. Loads user preferences from DB.
 */
export async function initialize(session: Session) {
  if (useSleepTimer.getState().initialized) {
    log.debug("Already initialized, skipping");
    return;
  }

  const settings = await getSleepTimerSettings(session.email);
  useSleepTimer.setState({
    initialized: true,
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
    sleepTimerMotionDetectionEnabled: settings.sleepTimerMotionDetectionEnabled,
  });

  setupStoreSubscriptions();
  log.debug("Initialized");
}

/**
 * Sets the enabled state for the sleep timer and persists it to the database.
 */
export async function setSleepTimerEnabled(session: Session, enabled: boolean) {
  log.debug(`Setting enabled to ${enabled}`);
  useSleepTimer.setState({ sleepTimerEnabled: enabled });
  await updateTimerState();
  await setSleepTimerEnabledDb(session.email, enabled);
}

/**
 * Sets the duration for the sleep timer and persists it to the database.
 * Resets the trigger time if the timer is currently active.
 */
export async function setSleepTimerTime(session: Session, seconds: number) {
  log.debug(`Setting time to ${seconds} seconds`);

  const { sleepTimerTriggerTime, sleepTimer: prevSleepTimer } =
    useSleepTimer.getState();

  useSleepTimer.setState({ sleepTimer: seconds });

  // Reset trigger time if timer is active and duration changed
  if (sleepTimerTriggerTime !== null && prevSleepTimer !== seconds) {
    await resetTriggerTime();
  }

  await setSleepTimerTimeDb(session.email, seconds);
}

/**
 * Result of attempting to enable motion detection.
 */
export type MotionDetectionResult = {
  success: boolean;
  permissionDenied?: boolean; // true if user previously denied and must go to Settings
};

/**
 * Sets whether motion detection should pause the sleep timer when user is moving.
 * Persists to database and updates timer state accordingly.
 *
 * When enabling, this will request permission if needed (iOS). If the user
 * denies permission, the setting will not be enabled.
 */
export async function setSleepTimerMotionDetectionEnabled(
  session: Session,
  enabled: boolean,
): Promise<MotionDetectionResult> {
  log.debug(`Setting motion detection to ${enabled}`);

  // When enabling, check/request permission first
  if (enabled) {
    const permissionResult = await requestActivityTrackingPermission();
    if (!permissionResult.granted) {
      log.info(
        "Activity tracking permission denied, not enabling motion detection",
      );
      useSleepTimer.setState({ sleepTimerMotionDetectionEnabled: false });
      return {
        success: false,
        permissionDenied: permissionResult.permanentlyDenied,
      };
    }
  }

  useSleepTimer.setState({ sleepTimerMotionDetectionEnabled: enabled });
  await updateTimerState();
  await setSleepTimerMotionDetectionEnabledDb(session.email, enabled);
  return { success: true };
}

// =============================================================================
// Core Timer Logic
// =============================================================================

/**
 * Central function that evaluates current conditions and updates timer state.
 * Call this whenever any relevant state changes (play/pause, enabled, motion, etc.)
 *
 * This is the heart of the sleep timer - all decisions flow through here.
 */
async function updateTimerState() {
  const {
    playing,
    sleepTimerEnabled,
    sleepTimerMotionDetectionEnabled,
    isStationary,
  } = useSleepTimer.getState();

  // Activity tracking: needed to detect when user starts/stops moving
  const shouldTrackActivity =
    playing && sleepTimerEnabled && sleepTimerMotionDetectionEnabled;

  // Timer runs unless user is actively moving (null/unknown = ok to run)
  const userIsMoving =
    sleepTimerMotionDetectionEnabled && isStationary === false;
  const shouldTimerRun = playing && sleepTimerEnabled && !userIsMoving;

  // --- Update activity tracking ---
  if (shouldTrackActivity && !isActivityTrackingActive()) {
    await startActivityTracking();
  } else if (!shouldTrackActivity && isActivityTrackingActive()) {
    stopActivityTracking();
  }

  // --- Update timer (check interval + trigger time are always in sync) ---
  if (shouldTimerRun && !isTimerCheckRunning()) {
    await startTimer();
  } else if (!shouldTimerRun && isTimerCheckRunning()) {
    await stopTimer();
  }
}

/**
 * Start the timer: set trigger time and begin periodic checks.
 */
async function startTimer() {
  const { sleepTimer } = useSleepTimer.getState();
  const triggerTime = Date.now() + sleepTimer * 1000;

  log.debug(`Starting timer, trigger at ${new Date(triggerTime)}`);
  setTriggerTime(triggerTime);
  await TrackPlayer.setVolume(1.0);
  timerCheckInterval = setInterval(checkTimer, TIMER_CHECK_INTERVAL_MS);
}

/**
 * Stop the timer: clear trigger time, stop checks, restore volume.
 */
async function stopTimer() {
  log.debug("Stopping timer");

  if (timerCheckInterval) {
    clearInterval(timerCheckInterval);
    timerCheckInterval = null;
  }

  setTriggerTime(null);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Reset trigger time to a fresh duration (used on seek events).
 */
async function resetTriggerTime() {
  if (!isTimerCheckRunning()) return;

  const { sleepTimer } = useSleepTimer.getState();
  const triggerTime = Date.now() + sleepTimer * 1000;

  log.debug(`Resetting trigger time to ${new Date(triggerTime)}`);
  setTriggerTime(triggerTime);
  await TrackPlayer.setVolume(1.0);
}

/**
 * Periodic check - handles volume fade and triggering pause.
 */
async function checkTimer() {
  const { sleepTimerTriggerTime } = useSleepTimer.getState();

  if (sleepTimerTriggerTime === null) {
    // Sanity check - shouldn't happen if state management is correct
    return;
  }

  const now = Date.now();
  const timeRemaining = sleepTimerTriggerTime - now;

  if (timeRemaining <= 0) {
    log.info("Timer triggered - pausing playback");
    await pause(PlayPauseSource.SLEEP_TIMER, SLEEP_TIMER_PAUSE_REWIND_SECONDS);
  } else if (timeRemaining <= SLEEP_TIMER_FADE_OUT_TIME) {
    const volume = timeRemaining / SLEEP_TIMER_FADE_OUT_TIME;
    log.debug(`Fading volume: ${volume.toFixed(2)}`);
    await TrackPlayer.setVolume(volume);
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Set up subscriptions to track-player store for play/pause and seek events.
 */
function setupStoreSubscriptions() {
  storeSubscriptions.push(
    subscribeToChange(
      useTrackPlayer,
      (s) => s.lastPlayPause,
      (event) => event && handlePlayPauseEvent(event),
    ),
  );

  storeSubscriptions.push(
    subscribeToChange(
      useTrackPlayer,
      (s) => s.lastSeek,
      (seek) => seek && handleSeekEvent(seek),
    ),
  );
}

/**
 * Handle play/pause events. Updates our own `playing` state from the event
 * (avoiding race conditions with TrackPlayer's isPlaying state).
 */
function handlePlayPauseEvent(event: PlayPauseEvent) {
  if (event.source === PlayPauseSource.INTERNAL) {
    log.debug("Ignoring INTERNAL play/pause event");
    return;
  }

  const playing = event.type === PlayPauseType.PLAY;
  log.debug(`Play/pause event: ${event.type}`);
  useSleepTimer.setState({ playing });
  updateTimerState();
}

/**
 * Handle seek events. Resets trigger time to give user fresh timer.
 */
function handleSeekEvent(seek: Seek) {
  if (seek.source === SeekSource.INTERNAL) return;
  log.debug(`Seek event from ${seek.source}, resetting trigger time`);
  resetTriggerTime();
}

/**
 * Handle activity state changes from the native module.
 */
function handleActivityStateChange(
  payload: ActivityTracker.ActivityStatePayload,
) {
  const isStationary =
    payload.state === ActivityTracker.ActivityState.STATIONARY;
  const prevIsStationary = useSleepTimer.getState().isStationary;

  useSleepTimer.setState({ isStationary });

  if (isStationary !== prevIsStationary) {
    log.info(
      `Activity state: ${payload.state} (confidence: ${payload.confidence})`,
    );
    updateTimerState();
  }
}

// =============================================================================
// Activity Tracking
// =============================================================================

type PermissionResult = {
  granted: boolean;
  permanentlyDenied: boolean;
};

/**
 * Request permission for activity tracking.
 */
async function requestActivityTrackingPermission(): Promise<PermissionResult> {
  const status = await ActivityTracker.getPermissionStatus();
  log.debug(`Activity tracker permission status: ${status}`);

  if (status === ActivityTracker.PermissionStatus.AUTHORIZED) {
    return { granted: true, permanentlyDenied: false };
  }

  if (
    status === ActivityTracker.PermissionStatus.DENIED ||
    status === ActivityTracker.PermissionStatus.RESTRICTED
  ) {
    return { granted: false, permanentlyDenied: true };
  }

  // NOT_DETERMINED - request permission
  log.debug("Requesting activity tracking permission...");
  const newStatus = await ActivityTracker.requestPermission();
  log.debug(`Permission result: ${newStatus}`);

  return {
    granted: newStatus === ActivityTracker.PermissionStatus.AUTHORIZED,
    permanentlyDenied:
      newStatus !== ActivityTracker.PermissionStatus.AUTHORIZED,
  };
}

/**
 * Start listening to activity state changes.
 */
async function startActivityTracking() {
  if (activitySubscription) return;

  const status = await ActivityTracker.getPermissionStatus();
  if (
    status === ActivityTracker.PermissionStatus.DENIED ||
    status === ActivityTracker.PermissionStatus.RESTRICTED
  ) {
    log.warn("Activity tracking not authorized");
    return;
  }

  log.debug("Starting activity tracking");
  useSleepTimer.setState({ isStationary: null });

  activitySubscription = ActivityTracker.addActivityStateListener(
    handleActivityStateChange,
  );

  const trackingStatus = await ActivityTracker.startTracking();
  if (trackingStatus !== ActivityTracker.TrackingStatus.STARTED) {
    log.warn(`Failed to start activity tracking: ${trackingStatus}`);
    activitySubscription?.remove();
    activitySubscription = null;
  }
}

/**
 * Stop listening to activity state changes.
 */
function stopActivityTracking() {
  if (!activitySubscription) return;

  log.debug("Stopping activity tracking");
  activitySubscription.remove();
  activitySubscription = null;
  ActivityTracker.stopTracking();
  useSleepTimer.setState({ isStationary: null });
}

// =============================================================================
// Testing Helpers
// =============================================================================

/**
 * Reset all module-level state for testing.
 */
export function resetForTesting() {
  if (timerCheckInterval) {
    clearInterval(timerCheckInterval);
    timerCheckInterval = null;
  }

  if (activitySubscription) {
    activitySubscription.remove();
    activitySubscription = null;
  }
  ActivityTracker.stopTracking();

  storeSubscriptions.forEach((unsubscribe) => unsubscribe());
  storeSubscriptions = [];

  resetSleepTimerStore();
}
