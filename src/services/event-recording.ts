/**
 * Event Recording Module
 *
 * Pure functions for recording playback events to the database.
 * All functions take explicit parameters - no module state, no TrackPlayer calls.
 *
 * These functions:
 * - Insert event rows into the playbackEvents table
 * - Update the playthroughStateCache for position tracking
 * - Use transactions to ensure atomicity
 *
 * Callers are responsible for:
 * - Tracking the current playthrough ID and rate
 * - Getting position/duration from TrackPlayer
 * - Deciding when to call these functions
 */

import { getDb } from "@/db/db";
import { updateStateCache } from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { getDeviceIdSync } from "@/stores/device";
import { useSession } from "@/stores/session";
import { randomUUID } from "@/utils/crypto";

// =============================================================================
// Playback Events (play, pause, seek, rate_change)
// =============================================================================

/**
 * Record a "play" event when playback starts.
 */
export async function recordPlayEvent(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "play",
      timestamp: now,
      position,
      playbackRate,
    });

    await updateStateCache(playthroughId, position, playbackRate, now, tx);
  });

  console.debug("[EventRecording] Recorded play event at position", position);
}

/**
 * Record a "pause" event when playback pauses.
 */
export async function recordPauseEvent(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "pause",
      timestamp: now,
      position,
      playbackRate,
    });

    await updateStateCache(playthroughId, position, playbackRate, now, tx);
  });

  console.debug("[EventRecording] Recorded pause event at position", position);
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

  console.debug(
    "[EventRecording] Recorded seek event from",
    fromPosition.toFixed(1),
    "to",
    toPosition.toFixed(1),
  );
}

/**
 * Record a "rate_change" event when playback speed changes.
 */
export async function recordRateChangeEvent(
  playthroughId: string,
  position: number,
  newRate: number,
  previousRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.insert(schema.playbackEvents).values({
      id: randomUUID(),
      playthroughId,
      deviceId: getDeviceIdSync(),
      type: "rate_change",
      timestamp: now,
      position,
      playbackRate: newRate,
      previousRate,
    });

    await updateStateCache(playthroughId, position, newRate, now, tx);
  });

  console.debug(
    "[EventRecording] Recorded rate change from",
    previousRate,
    "to",
    newRate,
  );
}

// =============================================================================
// Lifecycle Events (start, finish, abandon, resume)
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

  console.debug("[EventRecording] Recorded start event");
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

  console.debug("[EventRecording] Recorded finish event");
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

  console.debug("[EventRecording] Recorded abandon event");
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

  console.debug("[EventRecording] Recorded resume event");
}
