/**
 * Event Recording Service
 *
 * Records playback events to the database by subscribing to track player store
 * changes. This service is self-contained and automatically records events when
 * play/pause transitions, rate changes, or seeks occur.
 *
 * All events are debounced to reduce noise from rapid user interactions:
 *
 * - Play/pause: If toggled multiple times within the window, only records if
 *   the final state differs from the initial state. E.g., pause→play→pause→play
 *   records a single "play" event.
 *
 * - Rate changes: Accumulates changes within the window, recording only the
 *   first previousRate and final newRate. E.g., 1.0→1.25→1.5→1.75 records a
 *   single 1.0→1.75 event.
 *
 * - Seeks: Records the `from` of the first seek and `to` of the last seek.
 *
 * When switching playthroughs, all pending events are flushed immediately to
 * ensure they're recorded for the correct playthrough before the switch.
 */

import {
  PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW,
  RATE_CHANGE_EVENT_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/constants";
import { recordPlaybackEvent } from "@/db/playthroughs";
import { getDeviceInfo } from "@/stores/device";
import { useSession } from "@/stores/session";
import {
  PlayPauseEvent,
  PlayPauseSource,
  PlayPauseType,
  RateChange,
  Seek,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

import { syncPlaybackEvents } from "./sync-service";

const log = logBase.extend("event-recording");

let initialized = false;

type PlayPauseState = (typeof PlayPauseType)[keyof typeof PlayPauseType];

type PendingPlayPauseEvent = {
  stateBefore: PlayPauseState;
  finalState: PlayPauseState;
  timestamp: Date;
  playthroughId: string;
  position: number;
  playbackRate: number;
};

type PendingRateChangeEvent = {
  previousRate: number;
  newRate: number;
  timestamp: Date;
  playthroughId: string;
  position: number;
};

type PendingSeekEvent = {
  from: number;
  to: number;
  timestamp: Date;
  playthroughId: string;
  playbackRate: number;
};

let playPauseEventTimer: NodeJS.Timeout | null = null;
let pendingPlayPauseEvent: PendingPlayPauseEvent | null = null;

let rateChangeEventTimer: NodeJS.Timeout | null = null;
let pendingRateChangeEvent: PendingRateChangeEvent | null = null;

let seekEventTimer: NodeJS.Timeout | null = null;
let pendingSeekEvent: PendingSeekEvent | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the event recording service.
 */
export async function initialize() {
  if (initialized) {
    log.debug("Already initialized, skipping");
    return;
  }

  setupStoreSubscriptions();
  initialized = true;

  log.debug("Initialized");
}

// =============================================================================
// Internals
// =============================================================================

function setupStoreSubscriptions() {
  // When playthrough changes (or is unloaded), flush all pending events immediately
  subscribeToChange(
    useTrackPlayer,
    (s) => s.playthrough?.id,
    () => flushAllPendingEvents(),
  );

  subscribeToChange(
    useTrackPlayer,
    (s) => s.lastPlayPause,
    (event) => event && handlePlayPauseEvent(event),
  );

  subscribeToChange(
    useTrackPlayer,
    (s) => s.lastRateChange,
    (event) => event && handleRateChangeEvent(event),
  );

  subscribeToChange(
    useTrackPlayer,
    (s) => s.lastSeek,
    (seek) => seek && handleSeekEvent(seek),
  );
}

/**
 * Flush all pending events immediately. Called when the playthrough changes
 * to ensure events are recorded for the correct playthrough.
 */
function flushAllPendingEvents() {
  if (playPauseEventTimer) {
    clearTimeout(playPauseEventTimer);
    flushPlayPauseEvent();
  }
  if (rateChangeEventTimer) {
    clearTimeout(rateChangeEventTimer);
    flushRateChangeEvent();
  }
  if (seekEventTimer) {
    clearTimeout(seekEventTimer);
    flushSeekEvent();
  }
}

/**
 * Handle play/pause events from the store with debouncing.
 * Accumulates play/pause toggles within a window, recording only if the
 * state changed from before the first event to after the last event.
 * If we toggle back to the original state, the changes cancel out and
 * nothing is recorded.
 */
function handlePlayPauseEvent(event: PlayPauseEvent) {
  if (event.source === PlayPauseSource.INTERNAL) return;

  if (
    pendingPlayPauseEvent &&
    pendingPlayPauseEvent.playthroughId !== event.playthroughId
  ) {
    if (playPauseEventTimer) clearTimeout(playPauseEventTimer);
    flushPlayPauseEvent();
  }

  if (pendingPlayPauseEvent) {
    pendingPlayPauseEvent.finalState = event.type;
    pendingPlayPauseEvent.timestamp = new Date(event.timestamp);
    pendingPlayPauseEvent.position = event.position;
    pendingPlayPauseEvent.playbackRate = event.playbackRate;
  } else {
    const stateBefore =
      event.type === PlayPauseType.PLAY
        ? PlayPauseType.PAUSE
        : PlayPauseType.PLAY;
    pendingPlayPauseEvent = {
      stateBefore,
      finalState: event.type,
      timestamp: new Date(event.timestamp),
      playthroughId: event.playthroughId,
      position: event.position,
      playbackRate: event.playbackRate,
    };
  }

  if (playPauseEventTimer) clearTimeout(playPauseEventTimer);
  playPauseEventTimer = setTimeout(
    flushPlayPauseEvent,
    PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW,
  );
}

/**
 * Flush the accumulated play/pause event to the database.
 */
async function flushPlayPauseEvent() {
  playPauseEventTimer = null;

  if (!pendingPlayPauseEvent) return;

  const session = useSession.getState().session;
  if (!session) {
    pendingPlayPauseEvent = null;
    return;
  }

  const {
    stateBefore,
    finalState,
    timestamp,
    playthroughId,
    position,
    playbackRate,
  } = pendingPlayPauseEvent;
  pendingPlayPauseEvent = null;

  if (stateBefore === finalState) {
    log.debug(
      `Skipping play/pause event - toggled back to original state (${finalState === PlayPauseType.PLAY ? "playing" : "paused"})`,
    );
    return;
  }

  const eventType = finalState === PlayPauseType.PLAY ? "play" : "pause";

  const deviceId = (await getDeviceInfo()).id;

  await recordPlaybackEvent(
    session,
    playthroughId,
    deviceId,
    eventType,
    timestamp,
    position,
    playbackRate,
  );

  if (finalState === PlayPauseType.PAUSE) {
    syncPlaybackEvents(session);
  }
}

/**
 * Handle rate change events from the store with debouncing.
 * Accumulates rate changes within a window, recording a single event
 * with the initial previousRate and final newRate. If the rate ends up
 * the same as it started, nothing is recorded.
 */
function handleRateChangeEvent(event: RateChange) {
  if (
    pendingRateChangeEvent &&
    pendingRateChangeEvent.playthroughId !== event.playthroughId
  ) {
    if (rateChangeEventTimer) clearTimeout(rateChangeEventTimer);
    flushRateChangeEvent();
  }

  if (pendingRateChangeEvent) {
    pendingRateChangeEvent.newRate = event.newRate;
    pendingRateChangeEvent.timestamp = new Date(event.timestamp);
    pendingRateChangeEvent.position = event.position;
  } else {
    pendingRateChangeEvent = {
      previousRate: event.previousRate,
      newRate: event.newRate,
      timestamp: new Date(event.timestamp),
      playthroughId: event.playthroughId,
      position: event.position,
    };
  }

  if (rateChangeEventTimer) clearTimeout(rateChangeEventTimer);
  rateChangeEventTimer = setTimeout(
    flushRateChangeEvent,
    RATE_CHANGE_EVENT_ACCUMULATION_WINDOW,
  );
}

/**
 * Flush the accumulated rate change event to the database.
 */
async function flushRateChangeEvent() {
  rateChangeEventTimer = null;

  if (!pendingRateChangeEvent) return;

  const session = useSession.getState().session;
  if (!session) {
    pendingRateChangeEvent = null;
    return;
  }

  const { previousRate, newRate, timestamp, playthroughId, position } =
    pendingRateChangeEvent;
  pendingRateChangeEvent = null;

  if (previousRate === newRate) {
    log.debug(
      `Skipping rate change event - rate returned to original (${newRate.toFixed(2)})`,
    );
    return;
  }

  const deviceId = (await getDeviceInfo()).id;

  await recordPlaybackEvent(
    session,
    playthroughId,
    deviceId,
    "rate_change",
    timestamp,
    position,
    newRate,
    { previousRate },
  );
}

/**
 * Handle seek events from the store with debouncing.
 * Accumulates seeks within a window, recording the `from` of the first
 * seek and the `to` of the last seek. Context (playthroughId, playbackRate)
 * is captured from the first seek event.
 */
function handleSeekEvent(seek: Seek) {
  if (seek.source === SeekSource.INTERNAL) return;

  if (
    pendingSeekEvent &&
    pendingSeekEvent.playthroughId !== seek.playthroughId
  ) {
    if (seekEventTimer) clearTimeout(seekEventTimer);
    flushSeekEvent();
  }

  if (pendingSeekEvent) {
    pendingSeekEvent.to = seek.to;
    pendingSeekEvent.timestamp = new Date(seek.timestamp);
  } else {
    pendingSeekEvent = {
      from: seek.from,
      to: seek.to,
      timestamp: new Date(seek.timestamp),
      playthroughId: seek.playthroughId,
      playbackRate: seek.playbackRate,
    };
  }

  if (seekEventTimer) clearTimeout(seekEventTimer);
  seekEventTimer = setTimeout(flushSeekEvent, SEEK_EVENT_ACCUMULATION_WINDOW);
}

/**
 * Flush the accumulated seek event to the database.
 */
async function flushSeekEvent() {
  seekEventTimer = null;

  if (!pendingSeekEvent) return;

  const session = useSession.getState().session;
  if (!session) {
    pendingSeekEvent = null;
    return;
  }

  const { from, to, timestamp, playthroughId, playbackRate } = pendingSeekEvent;
  pendingSeekEvent = null;

  const trivialSeek = Math.abs(to - from) < 2;
  if (trivialSeek) {
    log.debug(
      `Skipping trivial seek from ${from.toFixed(1)} to ${to.toFixed(1)}`,
    );
    return;
  }

  const deviceId = (await getDeviceInfo()).id;

  await recordPlaybackEvent(
    session,
    playthroughId,
    deviceId,
    "seek",
    timestamp,
    to,
    playbackRate,
    { fromPosition: from, toPosition: to },
  );
}
