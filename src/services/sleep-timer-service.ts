import {
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
import { useSession } from "@/stores/session";
import { setTriggerTime, useSleepTimer } from "@/stores/sleep-timer";
import { Seek, SeekSource, useTrackPlayer } from "@/stores/track-player";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

import * as EventRecording from "./event-recording";
import * as Heartbeat from "./position-heartbeat";
import { syncPlaythroughs } from "./sync-service";

const log = logBase.extend("sleep-timer-service");

const SLEEP_TIMER_CHECK_INTERVAL = 1000;
let sleepTimerCheckInterval: NodeJS.Timeout | null = null;

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

  log.debug("Initializing...");

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
  log.debug("Setting enabled to", enabled);

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
  log.debug("Setting time to", seconds, "seconds");

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
  useTrackPlayer.subscribe((state, prevState) => {
    if (state.isPlaying.playing !== prevState.isPlaying.playing) {
      handleIsPlayingChange(state.isPlaying.playing);
    }

    if (
      state.lastSeek &&
      state.lastSeek.timestamp !== prevState.lastSeek?.timestamp
    ) {
      handleSeek(state.lastSeek);
    }
  });
}

/**
 * Handle changes to isPlaying state. Starts or stops the sleep timer
 * accordingly.
 */
function handleIsPlayingChange(isPlaying: boolean) {
  if (isPlaying) {
    // Started playing
    log.debug("Detected playback started");
    start();
  } else {
    // Stopped playing
    log.debug("Detected playback stopped");
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
  await resetTriggerTime();

  const { sleepTimerEnabled } = useSleepTimer.getState();

  if (!sleepTimerEnabled) {
    return;
  }

  log.debug("Starting timer check interval");
  sleepTimerCheckInterval = setInterval(checkTimer, SLEEP_TIMER_CHECK_INTERVAL);
}

/**
 * Stop the sleep timer interval check and clears the trigger time.
 */
async function stop() {
  clearTimerInterval();
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
  log.debug("Setting trigger time to", new Date(triggerTime));
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
    log.debug("Triggering - pausing playback");

    const loadedPlaythrough = Player.getLoadedPlaythrough();
    const playbackRate = Player.getPlaybackRate();
    const { position, duration } = await Player.getAccurateProgress();

    // FIXME:
    // We have to re-implement most of the pause logic from player-controls here
    await Player.pause();
    Heartbeat.stop();

    // seek back a bit
    let seekPosition =
      position - SLEEP_TIMER_PAUSE_REWIND_SECONDS * playbackRate;
    seekPosition = Math.max(0, Math.min(seekPosition, duration));
    await Player.seekTo(seekPosition, SeekSource.INTERNAL);

    if (loadedPlaythrough) {
      const { position } = await Player.getAccurateProgress();
      EventRecording.recordPauseEvent(
        loadedPlaythrough.id,
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
    log.debug("Fading volume:", volume.toFixed(2));
    await TrackPlayer.setVolume(volume);
  }
}
