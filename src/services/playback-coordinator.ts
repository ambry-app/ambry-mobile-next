import { setSleepTimerSettingsCallback } from "@/stores/sleep-timer";

import * as EventRecording from "./event-recording-service";
import type {
  ExpandPlayerCallback,
  RateChangedPayload,
  ScrubberSeekCallback,
  SeekAppliedPayload,
  SeekCompletedPayload,
} from "./playback-types";
import * as SleepTimer from "./sleep-timer-service";

// Module-level state
let expandPlayerCallback: ExpandPlayerCallback | null = null;
let scrubberSeekCallback: ScrubberSeekCallback | null = null;
let updatePlayerProgress:
  | ((position: number, duration: number) => void)
  | null = null;
let initialized = false;

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

  // When sleep timer triggers pause, only record the event.
  // Don't tell sleep timer about the pause - it already knows!
  SleepTimer.setOnPauseCallback(async () => {
    await EventRecording.handlePlaybackPaused();
  });

  SleepTimer.startMonitoring();
}

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
 * NOTE: Pass null to unregister (typically in useEffect cleanup).
 */
export function setExpandPlayerCallback(callback: ExpandPlayerCallback | null) {
  expandPlayerCallback = callback;
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
// Playback events (called by player.ts and playback-service.ts)
// ---------------------------------------------------------------------------

export async function onPlay() {
  await EventRecording.handlePlaybackStarted();
  SleepTimer.reset();
}

export async function onPause() {
  await EventRecording.handlePlaybackPaused();
  SleepTimer.cancel();
}

// ---------------------------------------------------------------------------
// TrackPlayer events (called by playback-service.ts)
// ---------------------------------------------------------------------------

export async function onQueueEnded() {
  await EventRecording.handlePlaybackQueueEnded();
  SleepTimer.cancel();
}

export function onRemoteDuck() {
  SleepTimer.reset();
}

// ---------------------------------------------------------------------------
// Seek events (called by player.ts and seek.ts)
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
  await EventRecording.handleSeekCompleted(payload);
}

// ---------------------------------------------------------------------------
// Rate change (called by player.ts)
// ---------------------------------------------------------------------------

export async function onRateChanged(payload: RateChangedPayload) {
  await EventRecording.handlePlaybackRateChanged(payload);
}

// ---------------------------------------------------------------------------
// UI events (called by player.ts)
// ---------------------------------------------------------------------------

export function expandPlayer() {
  expandPlayerCallback?.();
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

/**
 * Reset coordinator state for testing.
 */
export function __resetForTesting() {
  expandPlayerCallback = null;
  scrubberSeekCallback = null;
  updatePlayerProgress = null;
  initialized = false;
}
