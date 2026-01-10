/**
 * Event Recording Service
 *
 * Records playback events to the database by subscribing to track player store
 * changes. This service is self-contained and automatically records events when
 * play/pause transitions or rate changes occur.
 *
 * Lifecycle events (start, finish, abandon, resume) are still called explicitly
 * by the playthrough lifecycle service.
 */

import { getDb } from "@/db/db";
import { updateStateCache } from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { getDeviceIdSync } from "@/stores/device";
import { useSession } from "@/stores/session";
import {
  PlayPauseEvent,
  PlayPauseType,
  useTrackPlayer,
} from "@/stores/track-player";
import { randomUUID } from "@/utils/crypto";
import { logBase } from "@/utils/logger";
import { subscribeToChange } from "@/utils/subscribe";

const log = logBase.extend("event-recording");

let initialized = false;

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

/**
 * Record a "seek" event when user seeks to a new position.
 */
export async function recordSeekEvent(
  playthroughId: string,
  fromPosition: number,
  toPosition: number,
  playbackRate: number,
  timestamp: Date,
) {
  const session = useSession.getState().session;
  if (!session) return;

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "seek",
      timestamp,
      position: toPosition,
      playbackRate,
      fromPosition,
      toPosition,
    });

    await updateStateCache(
      playthroughId,
      toPosition,
      playbackRate,
      timestamp,
      tx,
    );
  });

  log.debug(
    `Recorded seek event from ${fromPosition.toFixed(1)} to ${toPosition.toFixed(1)}`,
  );
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
    (s) => s.playbackRate,
    handlePlaybackRateChange,
  );
}

async function handlePlayPauseEvent(event: PlayPauseEvent) {
  const { playthrough, playbackRate } = useTrackPlayer.getState();
  if (!playthrough) return;

  const session = useSession.getState().session;
  if (!session) return;

  const timestamp = new Date(event.timestamp);
  const eventType = event.type === PlayPauseType.PLAY ? "play" : "pause";

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId: playthrough.id,
      deviceId: getDeviceIdSync(),
      type: eventType,
      timestamp,
      position: event.position,
      playbackRate,
    });

    await updateStateCache(
      playthrough.id,
      event.position,
      playbackRate,
      timestamp,
      tx,
    );
  });

  log.debug(
    `Recorded ${eventType} event at position ${event.position.toFixed(1)}`,
  );
}

async function handlePlaybackRateChange(newRate: number, previousRate: number) {
  const { playthrough, progress } = useTrackPlayer.getState();
  if (!playthrough) return;

  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId: playthrough.id,
      deviceId: getDeviceIdSync(),
      type: "rate_change",
      timestamp: now,
      position: progress.position,
      playbackRate: newRate,
      previousRate,
    });

    await updateStateCache(playthrough.id, progress.position, newRate, now, tx);
  });

  log.debug(`Recorded rate change from ${previousRate} to ${newRate}`);
}
