import {
  SEEK_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/constants";
import {
  setLastSeek,
  setProgress,
  usePlayerUIState,
} from "@/stores/player-ui-state";

import * as EventRecording from "./event-recording";
import * as SleepTimer from "./sleep-timer-service";
import * as Player from "./trackplayer-wrapper";

// ============================================================================
// Types
// ============================================================================

export const SeekSource = {
  BUTTON: "button",
  CHAPTER: "chapter",
  REMOTE: "remote",
  SCRUBBER: "scrubber",
  PAUSE: "pause",
} as const;

export type SeekSourceType = (typeof SeekSource)[keyof typeof SeekSource];

// ============================================================================
// Module State (for core accumulation logic)
// ============================================================================

let seekTimer: NodeJS.Timeout | null = null;
let seekEventTimer: NodeJS.Timeout | null = null;

// Core state for accumulation logic
let isApplying = false;
let basePosition: number = 0;
let accumulator: number = 0;
let targetPosition: number = 0;

// State for debounced event recording
let eventFrom: number | null = null;
let eventTo: number | null = null;
let eventTimestamp: Date | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Seek to an absolute position.
 * The primary entry point for scrubber-based seeks.
 */
export async function seekTo(position: number, source: SeekSourceType) {
  if (isApplying) return;

  const { position: currentPosition } = await Player.getProgress();
  setupSeekTimers(currentPosition);

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

  // Trigger apply/record timers
  restartTimers(source);
}

/**
 * Seek relative to the current position.
 * The primary entry point for button-based seeks (UI or remote).
 */
export async function seekRelative(amount: number, source: SeekSourceType) {
  if (isApplying) return;

  // On first tap, get fresh data from the player
  if (!seekTimer) {
    const { position } = await Player.getProgress();
    setupSeekTimers(position);
  }

  // Accumulate the seek amount
  accumulator += amount;
  const { playbackRate } = usePlayerUIState.getState();
  targetPosition = basePosition + accumulator * playbackRate;

  // Update UI for button animation
  updateSeekUI(
    targetPosition,
    targetPosition - basePosition,
    amount > 0 ? "right" : "left",
  );

  // Trigger apply/record timers
  restartTimers(source);
}

/**
 * Seek by a small amount without creating a seek record.
 * Used for the rewind-on-pause feature.
 */
export async function seekImmediateNoLog(amount: number) {
  if (isApplying) return;
  isApplying = true;

  const { position, duration } = await Player.getProgress();
  const { playbackRate } = usePlayerUIState.getState();

  let newPosition = position + amount * playbackRate;
  newPosition = Math.max(0, Math.min(newPosition, duration));

  console.debug(
    "[Seek] Seeking from",
    position,
    "to",
    newPosition,
    "without logging",
  );

  await Player.seekTo(newPosition);

  // Update player store position and notify scrubber for animation
  setProgress(newPosition, duration);
  setLastSeek(SeekSource.PAUSE);

  isApplying = false;
}

// ============================================================================
// Internal Logic
// ============================================================================

/**
 * Set up the initial state for a new seeking interaction.
 */
function setupSeekTimers(currentPosition: number) {
  // First tap for apply timer
  if (!seekTimer) {
    basePosition = currentPosition;
    accumulator = 0;
    targetPosition = currentPosition;
  }
  // First tap for event recording timer
  if (!seekEventTimer) {
    eventFrom = currentPosition;
  }
}

/**
 * Clear and restart the timers that apply the seek and record the event.
 */
function restartTimers(source: SeekSourceType) {
  if (seekTimer) clearTimeout(seekTimer);
  if (seekEventTimer) clearTimeout(seekEventTimer);

  seekTimer = setTimeout(
    () => applyAccumulatedSeek(source),
    SEEK_ACCUMULATION_WINDOW,
  );
  seekEventTimer = setTimeout(recordSeekEvent, SEEK_EVENT_ACCUMULATION_WINDOW);
}

/**
 * Apply the accumulated seek to TrackPlayer and notify coordinator.
 */
async function applyAccumulatedSeek(source: SeekSourceType) {
  if (isApplying) return;
  isApplying = true;
  seekTimer = null;

  const { duration } = usePlayerUIState.getState();
  const positionToApply = Math.max(0, Math.min(targetPosition, duration));

  console.debug("[Seek] Applying seek to", positionToApply.toFixed(1));

  await Player.seekTo(positionToApply);

  // Store data for the debounced event recording
  eventTo = positionToApply;
  eventTimestamp = new Date();

  // --- Inlined from onSeekApplied ---
  // Update player store position (important for remote seeks from seek.ts)
  setProgress(positionToApply, duration);

  // Sleep timer resets on seek, unless it's a pause-related seek
  if (source !== "pause") {
    SleepTimer.maybeReset();
  }

  // Notify Scrubber for thumb animation
  setLastSeek(source);
  // --- End Inlined ---

  // Clear UI seeking state
  clearSeekUI();

  isApplying = false;
}

/**
 * Record the completed seek event after debounce.
 */
async function recordSeekEvent() {
  seekEventTimer = null;

  if (eventFrom === null || eventTo === null || eventTimestamp === null) {
    // This can happen if a seek was applied but another one started
    // before the event timer fired. It's safe to ignore.
    return;
  }

  console.debug(
    "[Seek] Recording debounced seek from",
    eventFrom.toFixed(1),
    "to",
    eventTo.toFixed(1),
  );

  // --- Inlined from onSeekCompleted ---
  const { loadedPlaythrough, playbackRate } = usePlayerUIState.getState();

  if (!loadedPlaythrough) return;

  const fromPosition = eventFrom;
  const toPosition = eventTo;

  // Don't record trivial seeks (< 2 seconds)
  if (Math.abs(toPosition - fromPosition) < 2) {
    return;
  }

  try {
    await EventRecording.recordSeekEvent(
      loadedPlaythrough.playthroughId,
      fromPosition,
      toPosition,
      playbackRate,
      eventTimestamp,
    );
  } catch (error) {
    console.warn("[Seek] Error recording seek event:", error);
  }
  // --- End Inlined ---

  // Reset event state for the next interaction
  eventFrom = null;
  eventTo = null;
  eventTimestamp = null;
}

// ============================================================================
// UI State Updates
// ============================================================================

/**
 * Update the UI-specific parts of the seek state in the Zustand store.
 */
function updateSeekUI(
  newPosition: number,
  diff: number,
  direction: "left" | "right" | null = null,
) {
  usePlayerUIState.setState({
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
  usePlayerUIState.setState({
    userIsSeeking: false,
    seekIsApplying: false,
    seekPosition: null,
    seekEffectiveDiff: null,
    seekLastDirection: null,
  });
}
