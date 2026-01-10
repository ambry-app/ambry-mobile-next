/**
 * Event Recording Service
 *
 * Records playback events to the database by subscribing to track player store
 * changes. This service is self-contained and automatically records events when
 * play/pause transitions, rate changes, or seeks occur.
 *
 * Seek events are debounced - when a user seeks multiple times in quick
 * succession, we record a single event with the `from` of the first seek and
 * the `to` of the last seek.
 *
 * Lifecycle events (start, finish, abandon, resume) are still called explicitly
 * by the playthrough lifecycle service.
 */

import { SEEK_EVENT_ACCUMULATION_WINDOW } from "@/constants";
import { getDb } from "@/db/db";
import { updateStateCache } from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { getDeviceIdSync } from "@/stores/device";
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
import { randomUUID } from "@/utils/crypto";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

import { syncPlaythroughs } from "./sync-service";

const log = logBase.extend("event-recording");

let initialized = false;

type PendingSeekEvent = {
  from: number;
  to: number;
  timestamp: Date;
  playthroughId: string;
  playbackRate: number;
};

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
// Lifecycle Events (called explicitly by playthrough-lifecycle)
// =============================================================================

/**
 * Record a "start" lifecycle event when a new playthrough begins.
 */
export async function recordStartEvent(playthroughId: string) {
  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "start",
    timestamp: now,
  });

  log.debug("Recorded start event");
}

/**
 * Record a "finish" lifecycle event when a playthrough is completed.
 */
export async function recordFinishEvent(playthroughId: string) {
  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "finish",
    timestamp: now,
  });

  log.debug("Recorded finish event");
}

/**
 * Record an "abandon" lifecycle event when a user abandons a playthrough.
 */
export async function recordAbandonEvent(playthroughId: string) {
  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "abandon",
    timestamp: now,
  });

  log.debug("Recorded abandon event");
}

/**
 * Record a "resume" lifecycle event when a user resumes a finished/abandoned playthrough.
 */
export async function recordResumeEvent(playthroughId: string) {
  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "resume",
    timestamp: now,
  });

  log.debug("Recorded resume event");
}

// =============================================================================
// Internals
// =============================================================================

function setupStoreSubscriptions() {
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

async function handlePlayPauseEvent(event: PlayPauseEvent) {
  if (event.source === PlayPauseSource.INTERNAL) return;

  const session = useSession.getState().session;
  if (!session) return;

  const { playthroughId, position, playbackRate } = event;
  const timestamp = new Date(event.timestamp);
  const eventType = event.type === PlayPauseType.PLAY ? "play" : "pause";

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: eventType,
      timestamp,
      position,
      playbackRate,
    });

    await updateStateCache(
      playthroughId,
      position,
      playbackRate,
      timestamp,
      tx,
    );
  });

  log.debug(`Recorded ${eventType} event at position ${position.toFixed(1)}`);

  if (event.type === PlayPauseType.PAUSE) {
    syncPlaythroughs(session);
  }
}

async function handleRateChangeEvent(event: RateChange) {
  const session = useSession.getState().session;
  if (!session) return;

  const { playthroughId, position, previousRate, newRate } = event;
  const timestamp = new Date(event.timestamp);

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "rate_change",
      timestamp,
      position,
      playbackRate: newRate,
      previousRate,
    });

    await updateStateCache(playthroughId, position, newRate, timestamp, tx);
  });

  log.debug(
    `Recorded rate change from ${previousRate.toFixed(2)} to ${newRate.toFixed(2)}`,
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

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "seek",
      timestamp,
      position: to,
      playbackRate,
      fromPosition: from,
      toPosition: to,
    });

    await updateStateCache(playthroughId, to, playbackRate, timestamp, tx);
  });

  log.debug(`Recorded seek event from ${from.toFixed(1)} to ${to.toFixed(1)}`);
}
