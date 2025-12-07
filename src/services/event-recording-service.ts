import * as Crypto from "expo-crypto";
import TrackPlayer from "react-native-track-player";

import { PROGRESS_SAVE_INTERVAL } from "@/src/constants";
import { db } from "@/src/db/db";
import {
  createPlaythrough,
  getActivePlaythrough,
  updateStateCache,
} from "@/src/db/playthroughs";
import * as schema from "@/src/db/schema";
import { syncPlaythroughs } from "@/src/db/sync";
import { getDeviceId, getDeviceIdSync } from "@/src/services/device-service";
import { Session, useSession } from "@/src/stores/session";
import { EventBus } from "@/src/utils";

let isInitialized = false;
let currentPlaythroughId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Track last known position for seek "from" calculation
let lastKnownPosition: number = 0;
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

  // Initialize device ID early so getDeviceIdSync() works in event handlers
  // This is especially important in the headless context where the main app's
  // boot sequence hasn't run
  await getDeviceId();

  EventBus.on("playbackStarted", handlePlaybackStarted);
  EventBus.on("playbackPaused", handlePlaybackPaused);
  EventBus.on("playbackQueueEnded", handlePlaybackQueueEnded);
  EventBus.on("seekApplied", handleSeekApplied);
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
  EventBus.off("seekApplied", handleSeekApplied);
  EventBus.off("playbackRateChanged", handlePlaybackRateChanged);
}

/**
 * Set the current playthrough for event recording.
 * Called when loading media into the player.
 */
export function setCurrentPlaythrough(
  playthroughId: string | null,
  initialPosition: number = 0,
  initialRate: number = 1,
) {
  currentPlaythroughId = playthroughId;
  lastKnownPosition = initialPosition;
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

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
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

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
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

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
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
 */
export async function initializePlaythroughTracking(
  session: Session,
  mediaId: string,
  position: number,
  playbackRate: number,
) {
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
      setCurrentPlaythrough(playthrough.id, position, playbackRate);
    }
  } catch (error) {
    console.warn("[EventRecording] Error initializing playthrough:", error);
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handlePlaybackStarted() {
  if (!currentPlaythroughId) return;

  try {
    const { position } = await TrackPlayer.getProgress();
    const rate = await TrackPlayer.getRate();
    currentPlaybackRate = rate;

    await recordPlayEvent(position, rate);
    startHeartbeat();
  } catch (error) {
    console.warn("[EventRecording] Error handling playback started:", error);
  }
}

async function handlePlaybackPaused() {
  if (!currentPlaythroughId) return;

  stopHeartbeat();

  try {
    const { position } = await TrackPlayer.getProgress();
    await recordPauseEvent(position, currentPlaybackRate);

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
  if (!currentPlaythroughId) return;

  stopHeartbeat();

  try {
    const { duration } = await TrackPlayer.getProgress();
    // Record pause at end position
    await recordPauseEvent(duration, currentPlaybackRate);
  } catch (error) {
    console.warn("[EventRecording] Error handling queue ended:", error);
  }
}

interface SeekAppliedEvent {
  position: number;
  duration: number;
  userInitiated: boolean;
  source?: string;
}

async function handleSeekApplied(event: SeekAppliedEvent) {
  if (!currentPlaythroughId) return;
  if (!event.userInitiated) return; // Don't record system seeks

  try {
    const fromPosition = lastKnownPosition;
    const toPosition = event.position;

    // Don't record trivial seeks (< 2 seconds)
    if (Math.abs(toPosition - fromPosition) < 2) {
      lastKnownPosition = toPosition;
      return;
    }

    await recordSeekEvent(fromPosition, toPosition, currentPlaybackRate);
    lastKnownPosition = toPosition;
  } catch (error) {
    console.warn("[EventRecording] Error handling seek:", error);
  }
}

interface RateChangedEvent {
  previousRate: number;
  newRate: number;
  position: number;
}

async function handlePlaybackRateChanged(event: RateChangedEvent) {
  if (!currentPlaythroughId) return;

  try {
    await recordRateChangeEvent(
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

    lastKnownPosition = position;

    console.debug(
      "[EventRecording] Heartbeat save at position",
      position.toFixed(1),
    );
  } catch (error) {
    console.warn("[EventRecording] Error in heartbeat save:", error);
  }
}

// =============================================================================
// Event Recording Functions
// =============================================================================

async function recordPlayEvent(position: number, playbackRate: number) {
  const session = useSession.getState().session;
  if (!session || !currentPlaythroughId) return;

  const now = new Date();

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
    playthroughId: currentPlaythroughId,
    deviceId: getDeviceIdSync(),
    type: "play",
    timestamp: now,
    position,
    playbackRate,
  });

  await updateStateCache(currentPlaythroughId, position, playbackRate, now);
  lastKnownPosition = position;

  console.debug("[EventRecording] Recorded play event at position", position);
}

async function recordPauseEvent(position: number, playbackRate: number) {
  const session = useSession.getState().session;
  if (!session || !currentPlaythroughId) return;

  const now = new Date();

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
    playthroughId: currentPlaythroughId,
    deviceId: getDeviceIdSync(),
    type: "pause",
    timestamp: now,
    position,
    playbackRate,
  });

  await updateStateCache(currentPlaythroughId, position, playbackRate, now);
  lastKnownPosition = position;

  console.debug("[EventRecording] Recorded pause event at position", position);
}

async function recordSeekEvent(
  fromPosition: number,
  toPosition: number,
  playbackRate: number,
) {
  const session = useSession.getState().session;
  if (!session || !currentPlaythroughId) return;

  const now = new Date();

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
    playthroughId: currentPlaythroughId,
    deviceId: getDeviceIdSync(),
    type: "seek",
    timestamp: now,
    position: toPosition,
    playbackRate,
    fromPosition,
    toPosition,
  });

  await updateStateCache(currentPlaythroughId, toPosition, playbackRate, now);

  console.debug(
    "[EventRecording] Recorded seek event from",
    fromPosition.toFixed(1),
    "to",
    toPosition.toFixed(1),
  );
}

async function recordRateChangeEvent(
  position: number,
  newRate: number,
  previousRate: number,
) {
  const session = useSession.getState().session;
  if (!session || !currentPlaythroughId) return;

  const now = new Date();

  await db.insert(schema.playbackEvents).values({
    id: Crypto.randomUUID(),
    playthroughId: currentPlaythroughId,
    deviceId: getDeviceIdSync(),
    type: "rate_change",
    timestamp: now,
    position,
    playbackRate: newRate,
    previousRate,
  });

  await updateStateCache(currentPlaythroughId, position, newRate, now);

  console.debug(
    "[EventRecording] Recorded rate change from",
    previousRate,
    "to",
    newRate,
  );
}
