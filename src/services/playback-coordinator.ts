/**
 * Playback Coordinator
 *
 * Central coordination point for playback-related events.
 * Tracks current playthrough state and orchestrates between:
 * - TrackPlayer (audio playback)
 * - EventRecording (pure DB operations)
 * - Heartbeat (periodic position saves)
 * - SleepTimer (auto-pause)
 * - Lifecycle (finish/abandon)
 * - UI callbacks (player expand, scrubber)
 */

import { syncPlaythroughs } from "@/db/sync";
import { useSession } from "@/stores/session";
import { setSleepTimerSettingsCallback } from "@/stores/sleep-timer";

import * as EventRecording from "./event-recording";
import type {
  ExpandPlayerCallback,
  RateChangedPayload,
  ScrubberSeekCallback,
  SeekAppliedPayload,
  SeekCompletedPayload,
} from "./playback-types";
import * as Lifecycle from "./playthrough-lifecycle";
import * as Heartbeat from "./position-heartbeat";
import * as SleepTimer from "./sleep-timer-service";
import * as Player from "./trackplayer-wrapper";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

// UI callbacks
let expandPlayerCallback: ExpandPlayerCallback | null = null;
let scrubberSeekCallback: ScrubberSeekCallback | null = null;
let updatePlayerProgress:
  | ((position: number, duration: number) => void)
  | null = null;
let pendingExpandPlayer = false;

// Initialization
let initialized = false;

// Current playthrough tracking
let currentPlaythroughId: string | null = null;
let currentPlaybackRate: number = 1;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the coordinator.
 * Sets up callbacks to break circular dependencies.
 *
 * NOTE: Can only be called once. Will warn on subsequent calls.
 */
export function initialize() {
  if (initialized) {
    console.warn("[Coordinator] Already initialized, skipping");
    return;
  }
  initialized = true;

  // Register callback for sleep timer settings changes (breaks store → coordinator cycle)
  setSleepTimerSettingsCallback((event) => {
    switch (event) {
      case "enabled":
        SleepTimer.maybeReset();
        break;
      case "disabled":
        SleepTimer.cancel();
        break;
      case "duration":
        SleepTimer.maybeReset();
        break;
    }
  });

  // When sleep timer triggers pause, stop heartbeat and record the event.
  // Don't tell sleep timer about the pause - it already knows!
  SleepTimer.setOnPauseCallback(async () => {
    Heartbeat.stop();
    await recordPauseEvent();
  });

  SleepTimer.startMonitoring();
}

// ---------------------------------------------------------------------------
// Playthrough Tracking
// ---------------------------------------------------------------------------

/**
 * Set the current playthrough for event recording.
 * Called when loading media into the player.
 *
 * NOTE: If we already have this exact playthrough (e.g., JS context persisted
 * across app "kill"), we skip reinitialization and just update the rate.
 */
export function setCurrentPlaythrough(
  playthroughId: string,
  position: number,
  playbackRate: number,
) {
  // If we already have this exact playthrough, just update the rate
  // This handles the case where JS context persisted across app "kill"
  if (currentPlaythroughId === playthroughId) {
    console.debug(
      "[Coordinator] Reusing existing playthrough:",
      currentPlaythroughId,
    );
    currentPlaybackRate = playbackRate;
    return;
  }

  currentPlaythroughId = playthroughId;
  currentPlaybackRate = playbackRate;
  console.debug(
    "[Coordinator] Set playthrough:",
    playthroughId,
    "position:",
    position,
    "rate:",
    playbackRate,
  );
}

/**
 * Get the current playthrough ID.
 * Returns null if no playthrough is loaded.
 */
export function getCurrentPlaythroughId(): string | null {
  return currentPlaythroughId;
}

/**
 * Get the current playback rate.
 */
export function getCurrentPlaybackRate(): number {
  return currentPlaybackRate;
}

// ---------------------------------------------------------------------------
// UI Callbacks Registration
// ---------------------------------------------------------------------------

/**
 * Register the player store progress updater.
 * Called once during app boot to avoid circular imports.
 *
 * NOTE: Only one updater can be registered. Subsequent calls will warn.
 */
export function setPlayerProgressUpdater(
  fn: (position: number, duration: number) => void,
) {
  if (updatePlayerProgress !== null) {
    console.warn("[Coordinator] Player progress updater already registered");
  }
  updatePlayerProgress = fn;
}

/**
 * Register callback for expanding the player UI.
 * Called by CustomTabBarWithPlayer when it mounts.
 *
 * If expandPlayer() was called before the callback was registered (e.g., app
 * launched from notification click before UI mounted), the callback will be
 * invoked immediately to handle the pending expand request.
 *
 * NOTE: Pass null to unregister (typically in useEffect cleanup).
 */
export function setExpandPlayerCallback(callback: ExpandPlayerCallback | null) {
  expandPlayerCallback = callback;

  // If there was a pending expand request, fulfill it now
  if (callback && pendingExpandPlayer) {
    console.debug("[Coordinator] Fulfilling pending expand request");
    pendingExpandPlayer = false;
    callback();
  }
}

/**
 * Register callback for scrubber seek animations.
 * Called by Scrubber when it mounts.
 *
 * NOTE: Pass null to unregister (typically in useEffect cleanup).
 */
export function setScrubberSeekCallback(callback: ScrubberSeekCallback | null) {
  scrubberSeekCallback = callback;
}

// ---------------------------------------------------------------------------
// Playback Events (called by player.ts and playback-service.ts)
// ---------------------------------------------------------------------------

export async function onPlay() {
  const playthroughId = currentPlaythroughId;
  if (!playthroughId) {
    SleepTimer.reset();
    return;
  }

  try {
    const { position } = await Player.getProgress();
    const rate = await Player.getRate();
    currentPlaybackRate = rate;

    await EventRecording.recordPlayEvent(playthroughId, position, rate);
    Heartbeat.start(playthroughId, rate);
  } catch (error) {
    console.warn("[Coordinator] Error recording play event:", error);
  }

  SleepTimer.reset();
}

export async function onPause() {
  Heartbeat.stop();
  await recordPauseEvent();
  SleepTimer.cancel();

  // Trigger sync in background after pause (non-blocking)
  triggerSyncOnPause();
}

/**
 * Internal helper to record a pause event.
 * Used by onPause() and sleep timer callback.
 */
async function recordPauseEvent() {
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  try {
    const { position } = await Player.getProgress();
    await EventRecording.recordPauseEvent(
      playthroughId,
      position,
      playbackRate,
    );
  } catch (error) {
    console.warn("[Coordinator] Error recording pause event:", error);
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
    console.warn("[Coordinator] Background sync on pause failed:", error);
  });
}

// ---------------------------------------------------------------------------
// TrackPlayer Events (called by playback-service.ts)
// ---------------------------------------------------------------------------

export async function onQueueEnded() {
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  Heartbeat.stop();

  // Record pause event at end position
  if (playthroughId) {
    try {
      const { duration } = await Player.getProgress();
      await EventRecording.recordPauseEvent(
        playthroughId,
        duration,
        playbackRate,
      );

      // Auto-finish the playthrough
      console.debug("[Coordinator] Playback ended, auto-finishing playthrough");
      await Lifecycle.finishPlaythrough(null, playthroughId);
    } catch (error) {
      console.warn("[Coordinator] Error handling queue ended:", error);
    }
  }

  SleepTimer.cancel();
}

export function onRemoteDuck() {
  SleepTimer.reset();
}

// ---------------------------------------------------------------------------
// Seek Events (called by player.ts and seek.ts)
// ---------------------------------------------------------------------------

export function onSeekApplied(payload: SeekAppliedPayload) {
  // Update player store position (important for remote seeks from seek.ts)
  updatePlayerProgress?.(payload.position, payload.duration);

  // Sleep timer resets on seek, unless it's a pause-related seek
  if (payload.source !== "pause") {
    SleepTimer.maybeReset();
  }

  // Notify Scrubber for thumb animation
  scrubberSeekCallback?.(payload);
}

export async function onSeekCompleted(payload: SeekCompletedPayload) {
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return;

  const { fromPosition, toPosition, timestamp } = payload;

  // Don't record trivial seeks (< 2 seconds)
  if (Math.abs(toPosition - fromPosition) < 2) {
    return;
  }

  try {
    await EventRecording.recordSeekEvent(
      playthroughId,
      fromPosition,
      toPosition,
      playbackRate,
      timestamp,
    );
  } catch (error) {
    console.warn("[Coordinator] Error recording seek event:", error);
  }
}

// ---------------------------------------------------------------------------
// Rate Change (called by player.ts)
// ---------------------------------------------------------------------------

export async function onRateChanged(payload: RateChangedPayload) {
  const playthroughId = currentPlaythroughId;

  if (!playthroughId) return;

  try {
    await EventRecording.recordRateChangeEvent(
      playthroughId,
      payload.position,
      payload.newRate,
      payload.previousRate,
    );
    currentPlaybackRate = payload.newRate;
    Heartbeat.setPlaybackRate(payload.newRate);
  } catch (error) {
    console.warn("[Coordinator] Error recording rate change:", error);
  }
}

// ---------------------------------------------------------------------------
// Pause and Record (for finish/abandon flows)
// ---------------------------------------------------------------------------

/**
 * Pause playback (if playing) and record the pause event, waiting for it to complete.
 * Use this when you need to ensure the pause event is recorded before
 * performing other operations (like marking a playthrough as finished/abandoned).
 *
 * Only records a pause event if audio is actually playing. If already paused,
 * this is a no-op (the pause event was already recorded when playback stopped).
 *
 * Returns true if a pause was recorded, false if already paused.
 * Caller is responsible for stopping heartbeat if needed.
 */
export async function pauseAndRecordEvent(): Promise<boolean> {
  const playthroughId = currentPlaythroughId;
  const playbackRate = currentPlaybackRate;

  if (!playthroughId) return false;

  // Check if actually playing - if not, nothing to do
  const { playing } = await Player.isPlaying();
  if (!playing) {
    console.debug("[Coordinator] pauseAndRecordEvent: not playing, skipping");
    return false;
  }

  try {
    // Pause the player
    await Player.pause();

    // Record the pause event and wait for it to complete
    const { position } = await Player.getProgress();
    await EventRecording.recordPauseEvent(
      playthroughId,
      position,
      playbackRate,
    );

    console.debug("[Coordinator] pauseAndRecordEvent completed");
    return true;
  } catch (error) {
    console.warn("[Coordinator] Error in pauseAndRecordEvent:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// UI Events (called by player.ts)
// ---------------------------------------------------------------------------

export function expandPlayer() {
  if (expandPlayerCallback) {
    expandPlayerCallback();
  } else {
    // Callback not registered yet (e.g., app launching from notification click).
    // Set pending flag so it expands when callback is registered.
    console.debug(
      "[Coordinator] No expand callback registered, setting pending",
    );
    pendingExpandPlayer = true;
  }
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/**
 * Reset coordinator state for testing.
 */
export function __resetForTesting() {
  expandPlayerCallback = null;
  scrubberSeekCallback = null;
  updatePlayerProgress = null;
  initialized = false;
  pendingExpandPlayer = false;
  currentPlaythroughId = null;
  currentPlaybackRate = 1;
}
