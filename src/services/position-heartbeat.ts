/**
 * Position Heartbeat Service
 *
 * Manages periodic saving of playback position to the state cache.
 * This runs during playback to ensure position is saved even if the app
 * crashes or is force-killed.
 *
 * Extracted from event-recording-service.ts to separate concerns:
 * - Event recording: records discrete playback events (play, pause, seek)
 * - Position heartbeat: periodic background saves (no events created)
 */

import { PROGRESS_SAVE_INTERVAL } from "@/constants";
import { updateStateCache } from "@/db/playthroughs";
import * as Player from "@/services/trackplayer-wrapper";

// =============================================================================
// Module State
// =============================================================================

let heartbeatInterval: NodeJS.Timeout | null = null;
let currentPlaythroughId: string | null = null;
let currentPlaybackRate: number = 1;

// =============================================================================
// Public API
// =============================================================================

/**
 * Start the position heartbeat.
 * Saves position every PROGRESS_SAVE_INTERVAL (30 seconds).
 *
 * @param playthroughId - The playthrough to save position for
 * @param playbackRate - Current playback rate (used for state cache)
 */
export function start(playthroughId: string, playbackRate: number): void {
  if (heartbeatInterval) {
    // Already running - update state but don't create new interval
    currentPlaythroughId = playthroughId;
    currentPlaybackRate = playbackRate;
    return;
  }

  currentPlaythroughId = playthroughId;
  currentPlaybackRate = playbackRate;

  heartbeatInterval = setInterval(async () => {
    await save();
  }, PROGRESS_SAVE_INTERVAL);

  console.debug("[Heartbeat] Started for playthrough:", playthroughId);
}

/**
 * Stop the position heartbeat.
 */
export function stop(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.debug("[Heartbeat] Stopped");
  }
}

/**
 * Update the playback rate used for state cache updates.
 * Call this when the playback rate changes during playback.
 */
export function setPlaybackRate(rate: number): void {
  currentPlaybackRate = rate;
}

/**
 * Force an immediate save of the current playback position.
 * Call this before reloading the player to preserve position.
 */
export async function saveNow(): Promise<void> {
  await save();
}

/**
 * Check if the heartbeat is currently running.
 */
export function isRunning(): boolean {
  return heartbeatInterval !== null;
}

// =============================================================================
// Internal
// =============================================================================

async function save(): Promise<void> {
  if (!currentPlaythroughId) return;

  try {
    const { position } = await Player.getProgress();

    // Update state cache without creating events (background save)
    await updateStateCache(currentPlaythroughId, position, currentPlaybackRate);

    console.debug("[Heartbeat] Saved position:", position.toFixed(1));
  } catch (error) {
    console.warn("[Heartbeat] Error saving position:", error);
  }
}

// =============================================================================
// Testing
// =============================================================================

/**
 * Reset service state for testing.
 */
export function __resetForTesting(): void {
  stop();
  currentPlaythroughId = null;
  currentPlaybackRate = 1;
}
