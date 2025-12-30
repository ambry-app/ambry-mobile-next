import { PROGRESS_SAVE_INTERVAL } from "@/constants";
import { getDb } from "@/db/db";
import { updateStateCache } from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { syncPlaythroughs } from "@/db/sync";
import * as Player from "@/services/trackplayer-wrapper";
import { getDeviceIdSync, initializeDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { randomUUID } from "@/utils/crypto";

import type {
  RateChangedPayload,
  SeekCompletedPayload,
} from "./playback-types";
import * as Lifecycle from "./playthrough-lifecycle";

let isInitialized = false;
let currentPlaythroughId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

let currentPlaybackRate: number = 1;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the event recording service.
 * Called from playback-service.ts during service setup.
 * Initializes the device store so getDeviceIdSync() works in event handlers.
 */
export async function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  console.debug("[EventRecording] Initializing");

  // Initialize device store so getDeviceIdSync() works in event handlers
  await initializeDevice();
}

/**
 * Set the current playthrough for event recording.
 * Called when loading media into the player.
 */
function setCurrentPlaythrough(
  playthroughId: string,
  initialPosition: number = 0,
  initialRate: number = 1,
) {
  currentPlaythroughId = playthroughId;
  currentPlaybackRate = initialRate;
  console.debug(
    "[EventRecording] Set playthrough:",
    playthroughId,
    "position:",
    initialPosition,
    "rate:",
    initialRate,
  );
}

// =============================================================================
// Lifecycle Event Recording (exported for UI use)
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

// =============================================================================
// Playthrough Initialization (called from playthrough-transitions.ts)
// =============================================================================

/**
 * Initialize playthrough tracking for event recording.
 * Called after a playthrough has been loaded into TrackPlayer.
 *
 * This function receives the playthroughId directly - it does NOT query the
 * database to find/create a playthrough. That responsibility belongs to the
 * caller (playthrough-transitions.ts).
 *
 * NOTE: If we already have this exact playthrough (e.g., JS context persisted
 * across app "kill"), we skip reinitialization and just update position/rate.
 */
export function initializePlaythroughTracking(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  // If we already have this exact playthrough, just update position/rate
  // This handles the case where JS context persisted across app "kill"
  if (currentPlaythroughId === playthroughId) {
    console.debug(
      "[EventRecording] Reusing existing playthrough:",
      currentPlaythroughId,
    );
    currentPlaybackRate = playbackRate;
    return;
  }

  setCurrentPlaythrough(playthroughId, position, playbackRate);
}

// =============================================================================
// Event Handlers (exported for coordinator to call directly)
// =============================================================================

export async function handlePlaybackStarted() {
  // Capture at the start - may change during async operations
  const playthroughId = currentPlaythroughId;

  if (!playthroughId) return;

  try {
    const { position } = await Player.getProgress();
    const rate = await Player.getRate();
    currentPlaybackRate = rate;

    await recordPlayEvent(playthroughId, position, rate);
    startHeartbeat();
  } catch (error) {
    console.warn("[EventRecording] Error handling playback started:", error);
  }
}

export async function handlePlaybackPaused() {
  // Capture these at the start - they may change during async operations
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  stopHeartbeat();

  try {
    const { position } = await Player.getProgress();
    await recordPauseEvent(playthroughId, position, playbackRate);

    // Trigger sync in background after pause (non-blocking)
    triggerSyncOnPause();
  } catch (error) {
    console.warn("[EventRecording] Error handling playback paused:", error);
  }
}

/**
 * Trigger a sync after pause without blocking the UI.
 * Runs asynchronously in the background.
 */
function triggerSyncOnPause() {
  const session = useSession.getState().session;
  if (!session) return;

  // Fire and forget - don't await
  syncPlaythroughs(session).catch((error) => {
    console.warn("[EventRecording] Background sync on pause failed:", error);
  });
}

export async function handlePlaybackQueueEnded() {
  // Capture these at the start - they may change during async operations
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  stopHeartbeat();

  try {
    const { duration } = await Player.getProgress();

    // Record pause at end position (audio already stopped, just recording the event)
    await recordPauseEvent(playthroughId, duration, playbackRate);

    // Delegate to lifecycle service for finish bookkeeping
    // (records finish event, updates DB, clears active playthrough, bumps version, syncs)
    console.debug("[EventRecording] Playback ended, delegating to lifecycle");
    await Lifecycle.finishPlaythrough(null, playthroughId);
  } catch (error) {
    console.warn("[EventRecording] Error handling queue ended:", error);
  }
}

/**
 * Handle debounced seek completion.
 * Records the seek event to the database.
 * Uses the timestamp from when the seek was actually applied, not when this
 * debounced event fired.
 */
export async function handleSeekCompleted(event: SeekCompletedPayload) {
  // Capture at the start - may change during async operations
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  try {
    const { fromPosition, toPosition, timestamp } = event;

    // Don't record trivial seeks (< 2 seconds)
    if (Math.abs(toPosition - fromPosition) < 2) {
      return;
    }

    await recordSeekEvent(
      playthroughId,
      fromPosition,
      toPosition,
      playbackRate,
      timestamp,
    );
  } catch (error) {
    console.warn("[EventRecording] Error handling seek completed:", error);
  }
}

export async function handlePlaybackRateChanged(event: RateChangedPayload) {
  // Capture at the start - may change during async operations
  const playthroughId = currentPlaythroughId;

  if (!playthroughId) return;

  try {
    await recordRateChangeEvent(
      playthroughId,
      event.position,
      event.newRate,
      event.previousRate,
    );
    currentPlaybackRate = event.newRate;
  } catch (error) {
    console.warn("[EventRecording] Error handling rate change:", error);
  }
}

// =============================================================================
// Heartbeat (state cache update only, no events)
// =============================================================================

function startHeartbeat() {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    await heartbeatSave();
  }, PROGRESS_SAVE_INTERVAL);

  console.debug("[EventRecording] Started heartbeat");
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.debug("[EventRecording] Stopped heartbeat");
  }
}

async function heartbeatSave() {
  if (!currentPlaythroughId) return;

  try {
    const { position } = await Player.getProgress();

    // Update state cache without creating events (background save)
    await updateStateCache(currentPlaythroughId, position, currentPlaybackRate);

    console.debug(
      "[EventRecording] Heartbeat save at position",
      position.toFixed(1),
    );
  } catch (error) {
    console.warn("[EventRecording] Error in heartbeat save:", error);
  }
}

/**
 * Force an immediate save of the current playback position.
 * Call this before reloading the player to preserve position.
 */
export async function saveCurrentProgress() {
  await heartbeatSave();
}

/**
 * Pause playback (if playing) and record the pause event, waiting for it to complete.
 * Use this when you need to ensure the pause event is recorded before
 * performing other operations (like marking a playthrough as finished/abandoned).
 *
 * Only records a pause event if audio is actually playing. If already paused,
 * this is a no-op (the pause event was already recorded when playback stopped).
 *
 * Unlike pauseIfPlaying() in player.ts which notifies the coordinator
 * asynchronously, this function awaits the event recording before returning.
 */
export async function pauseAndRecordEvent() {
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  // Check if actually playing - if not, nothing to do
  const { playing } = await Player.isPlaying();
  if (!playing) {
    console.debug(
      "[EventRecording] pauseAndRecordEvent: not playing, skipping",
    );
    return;
  }

  stopHeartbeat();

  try {
    // Pause the player
    await Player.pause();

    // Record the pause event and wait for it to complete
    const { position } = await Player.getProgress();
    await recordPauseEvent(playthroughId, position, playbackRate);

    console.debug("[EventRecording] pauseAndRecordEvent completed");
  } catch (error) {
    console.warn("[EventRecording] Error in pauseAndRecordEvent:", error);
  }
}

// =============================================================================
// Event Recording Functions
// =============================================================================

async function recordPlayEvent(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "play",
    timestamp: now,
    position,
    playbackRate,
  });

  await updateStateCache(playthroughId, position, playbackRate, now);

  console.debug("[EventRecording] Recorded play event at position", position);
}

async function recordPauseEvent(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "pause",
    timestamp: now,
    position,
    playbackRate,
  });

  await updateStateCache(playthroughId, position, playbackRate, now);

  console.debug("[EventRecording] Recorded pause event at position", position);
}

async function recordSeekEvent(
  playthroughId: string,
  fromPosition: number,
  toPosition: number,
  playbackRate: number,
  timestamp: Date,
) {
  const session = useSession.getState().session;
  if (!session) return;

  await getDb().insert(schema.playbackEvents).values({
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

  await updateStateCache(playthroughId, toPosition, playbackRate, timestamp);

  console.debug(
    "[EventRecording] Recorded seek event from",
    fromPosition.toFixed(1),
    "to",
    toPosition.toFixed(1),
  );
}

async function recordRateChangeEvent(
  playthroughId: string,
  position: number,
  newRate: number,
  previousRate: number,
) {
  const session = useSession.getState().session;
  if (!session) return;

  const now = new Date();

  await getDb().insert(schema.playbackEvents).values({
    id: randomUUID(),
    playthroughId,
    deviceId: getDeviceIdSync(),
    type: "rate_change",
    timestamp: now,
    position,
    playbackRate: newRate,
    previousRate,
  });

  await updateStateCache(playthroughId, position, newRate, now);

  console.debug(
    "[EventRecording] Recorded rate change from",
    previousRate,
    "to",
    newRate,
  );
}

/**
 * Reset service state for testing.
 * Clears all module state.
 */
export function __resetForTesting() {
  stopHeartbeat();
  currentPlaythroughId = null;
  currentPlaybackRate = 1;
  isInitialized = false;
}
