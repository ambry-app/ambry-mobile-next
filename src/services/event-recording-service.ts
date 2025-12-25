import TrackPlayer from "react-native-track-player";

import { PROGRESS_SAVE_INTERVAL } from "@/constants";
import { getDb } from "@/db/db";
import {
  createPlaythrough,
  getActivePlaythrough,
  updatePlaythroughStatus,
  updateStateCache,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { syncPlaythroughs } from "@/db/sync";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { getDeviceIdSync, initializeDevice } from "@/stores/device";
import { Session, useSession } from "@/stores/session";
import { EventBus } from "@/utils";
import { randomUUID } from "@/utils/crypto";

let isInitialized = false;
let currentMediaId: string | null = null;
let currentPlaythroughId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

let currentPlaybackRate: number = 1;

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the event recording service.
 * Called from playback-service.ts during service setup.
 */

export async function startMonitoring() {
  if (isInitialized) return;
  isInitialized = true;
  console.debug("[EventRecording] Initializing");

  // Initialize device store so getDeviceIdSync() works in event handlers
  await initializeDevice();

  EventBus.on("playbackStarted", handlePlaybackStarted);
  EventBus.on("playbackPaused", handlePlaybackPaused);
  EventBus.on("playbackQueueEnded", handlePlaybackQueueEnded);
  EventBus.on("seekCompleted", handleSeekCompleted);
  EventBus.on("playbackRateChanged", handlePlaybackRateChanged);
}

/**
 * Stop monitoring playback events.
 */
export function stopMonitoring() {
  console.debug("[EventRecording] Stopping");
  stopHeartbeat();
  isInitialized = false;
  EventBus.off("playbackStarted", handlePlaybackStarted);
  EventBus.off("playbackPaused", handlePlaybackPaused);
  EventBus.off("playbackQueueEnded", handlePlaybackQueueEnded);
  EventBus.off("seekCompleted", handleSeekCompleted);
  EventBus.off("playbackRateChanged", handlePlaybackRateChanged);
}

/**
 * Set the current playthrough for event recording.
 * Called when loading media into the player.
 */
function setCurrentPlaythrough(
  mediaId: string,
  playthroughId: string,
  initialPosition: number = 0,
  initialRate: number = 1,
) {
  currentMediaId = mediaId;
  currentPlaythroughId = playthroughId;
  currentPlaybackRate = initialRate;
  console.debug(
    "[EventRecording] Set playthrough:",
    playthroughId,
    "for media:",
    mediaId,
    "position:",
    initialPosition,
    "rate:",
    initialRate,
  );
}

/**
 * Get the current playthrough ID (if any).
 */
export function getCurrentPlaythroughId(): string | null {
  return currentPlaythroughId;
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

// =============================================================================
// Playthrough Initialization (called directly from player.ts)
// =============================================================================

/**
 * Initialize playthrough tracking for a media item.
 * Called directly from player.ts when media is loaded.
 * Gets or creates an active playthrough and sets up event recording.
 *
 * NOTE: If we already have a playthrough for this exact media (e.g., JS context
 * persisted across app "kill"), we skip the DB query and just update position/rate.
 * This is the same pattern used for sleep timer - trust in-memory state when valid.
 */
export async function initializePlaythroughTracking(
  session: Session,
  mediaId: string,
  position: number,
  playbackRate: number,
) {
  // If we already have a playthrough for this exact media, just update position/rate
  // This handles the case where JS context persisted across app "kill"
  if (currentMediaId === mediaId && currentPlaythroughId !== null) {
    console.debug(
      "[EventRecording] Reusing existing playthrough:",
      currentPlaythroughId,
    );
    currentPlaybackRate = playbackRate;
    return;
  }

  try {
    // Get or create playthrough for event recording
    let playthrough = await getActivePlaythrough(session, mediaId);

    if (!playthrough) {
      console.debug(
        "[EventRecording] No active playthrough found; creating new one",
      );
      const playthroughId = await createPlaythrough(session, mediaId);
      await recordStartEvent(playthroughId);
      playthrough = await getActivePlaythrough(session, mediaId);
    } else {
      console.debug(
        "[EventRecording] Found active playthrough:",
        playthrough.id,
      );
    }

    // Set up event recording for this playthrough
    if (playthrough) {
      setCurrentPlaythrough(mediaId, playthrough.id, position, playbackRate);
    }
  } catch (error) {
    console.warn("[EventRecording] Error initializing playthrough:", error);
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handlePlaybackStarted() {
  // Capture at the start - may change during async operations
  const playthroughId = currentPlaythroughId;

  if (!playthroughId) return;

  try {
    const { position } = await TrackPlayer.getProgress();
    const rate = await TrackPlayer.getRate();
    currentPlaybackRate = rate;

    await recordPlayEvent(playthroughId, position, rate);
    startHeartbeat();
  } catch (error) {
    console.warn("[EventRecording] Error handling playback started:", error);
  }
}

async function handlePlaybackPaused() {
  // Capture these at the start - they may change during async operations
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  stopHeartbeat();

  try {
    const { position } = await TrackPlayer.getProgress();
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

async function handlePlaybackQueueEnded() {
  // Capture these at the start - they may change during async operations
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  const session = useSession.getState().session;
  if (!session) return;

  stopHeartbeat();

  try {
    const { duration } = await TrackPlayer.getProgress();

    // Record pause at end position
    await recordPauseEvent(playthroughId, duration, playbackRate);

    // Mark playthrough as finished
    console.debug("[EventRecording] Playback ended, marking as finished");
    await recordFinishEvent(playthroughId);
    await updatePlaythroughStatus(session, playthroughId, "finished", {
      finishedAt: new Date(),
    });

    // Notify UI that playthrough data changed
    bumpPlaythroughDataVersion();

    // Trigger sync in background (non-blocking)
    syncPlaythroughs(session).catch((error) => {
      console.warn("[EventRecording] Background sync on finish failed:", error);
    });
  } catch (error) {
    console.warn("[EventRecording] Error handling queue ended:", error);
  }
}

interface SeekCompletedEvent {
  fromPosition: number;
  toPosition: number;
  timestamp: Date;
}

/**
 * Handle debounced seek completion.
 * Records the seek event to the database.
 * Uses the timestamp from when the seek was actually applied, not when this
 * debounced event fired.
 */
async function handleSeekCompleted(event: SeekCompletedEvent) {
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

interface RateChangedEvent {
  previousRate: number;
  newRate: number;
  position: number;
}

async function handlePlaybackRateChanged(event: RateChangedEvent) {
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
    const { position } = await TrackPlayer.getProgress();

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
  EventBus.emit("playbackEventRecorded");
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
  EventBus.emit("playbackEventRecorded");
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
  EventBus.emit("playbackEventRecorded");
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
  EventBus.emit("playbackEventRecorded");
}

/**
 * Reset service state for testing.
 * Clears all module state and removes event listeners.
 */
export function __resetForTesting() {
  stopMonitoring();
  currentMediaId = null;
  currentPlaythroughId = null;
  currentPlaybackRate = 1;
  isInitialized = false;
}
