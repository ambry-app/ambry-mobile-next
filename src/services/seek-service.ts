/**
 * Seek Service
 *
 * Handles user-initiated seeking (scrubbing and button-based) with accumulation
 * and delay so as to not overwhelm the audio player with rapid seek commands.
 *
 * This service owns the seek-ui-state store.
 */

import { SEEK_ACCUMULATION_WINDOW } from "@/constants";
import { clearSeekingState, setSeekingState } from "@/stores/seek-ui-state";
import { SeekSourceType } from "@/stores/track-player";
import { logBase } from "@/utils/logger";

import * as Player from "./track-player-service";

const log = logBase.extend("seek-service");

let seekTimer: NodeJS.Timeout | null = null;

// Core state for accumulation logic
let isApplying = false;
let basePosition: number = 0;
let accumulator: number = 0;
let targetPosition: number = 0;

// ============================================================================
// Public API
// ============================================================================

/**
 * Seek to an absolute position.
 * The primary entry point for scrubber-based seeks.
 */
export async function seekTo(position: number, source: SeekSourceType) {
  if (isApplying) return;

  const { position: currentPosition } = await Player.getAccurateProgress();
  setupSeekState(currentPosition);

  // Update state for absolute seek
  basePosition = position;
  accumulator = 0;
  targetPosition = position;

  // Update UI for scrubber animation
  updateSeekUI(
    targetPosition,
    targetPosition - currentPosition,
    targetPosition > currentPosition ? "right" : "left",
  );

  // Trigger apply timer
  restartTimer(source);
}

/**
 * Seek relative to the current position.
 * The primary entry point for button-based seeks (UI or remote).
 */
export async function seekRelative(amount: number, source: SeekSourceType) {
  if (isApplying) return;

  // On first tap, get fresh data from the player
  if (!seekTimer) {
    const { position } = await Player.getAccurateProgress();
    setupSeekState(position);
  }

  // Accumulate the seek amount
  accumulator += amount;
  const playbackRate = Player.getPlaybackRate();
  targetPosition = basePosition + accumulator * playbackRate;

  // Update UI for button animation
  // Use accumulator (real time) for the diff, not book time
  updateSeekUI(targetPosition, accumulator, amount > 0 ? "right" : "left");

  // Trigger apply timer
  restartTimer(source);
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Set up the initial state for a new seeking interaction.
 */
function setupSeekState(currentPosition: number) {
  if (!seekTimer) {
    basePosition = currentPosition;
    accumulator = 0;
    targetPosition = currentPosition;
  }
}

/**
 * Clear and restart the timer that applies the accumulated seek.
 */
function restartTimer(source: SeekSourceType) {
  if (seekTimer) clearTimeout(seekTimer);

  seekTimer = setTimeout(
    () => applyAccumulatedSeek(source),
    SEEK_ACCUMULATION_WINDOW,
  );
}

/**
 * Apply the accumulated seek to TrackPlayer.
 */
async function applyAccumulatedSeek(source: SeekSourceType) {
  if (isApplying) return;
  isApplying = true;
  seekTimer = null;

  const { duration } = Player.getProgress();
  const positionToApply = Math.max(0, Math.min(targetPosition, duration));

  log.debug(`Applying seek to ${positionToApply.toFixed(1)}`);

  await Player.seekTo(positionToApply, source);

  // Clear UI seeking state
  clearSeekUI();

  isApplying = false;
}

/**
 * Update the UI-specific parts of the seek state in the Zustand store.
 */
function updateSeekUI(
  newPosition: number,
  diff: number,
  direction: "left" | "right" | null = null,
) {
  setSeekingState({
    userIsSeeking: true,
    seekPosition: newPosition,
    seekEffectiveDiff: diff,
    seekLastDirection: direction,
  });
}

/**
 * Clear the UI-specific seeking state from the Zustand store.
 */
function clearSeekUI() {
  clearSeekingState();
}
