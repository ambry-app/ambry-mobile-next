import { create } from "zustand";

import {
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
} from "@/constants";

export interface SleepTimerState {
  initialized: boolean;
  sleepTimer: number; // Duration in seconds
  sleepTimerEnabled: boolean; // Whether enabled
  sleepTimerMotionDetectionEnabled: boolean; // Whether motion detection resets timer
  sleepTimerTriggerTime: number | null; // Unix timestamp in milliseconds (in-memory only)

  // Playback state (updated by play/pause events, avoids race condition with Player.isPlaying())
  playing: boolean;

  // Activity tracking state
  isStationary: boolean | null; // null = unknown, true = stationary, false = moving
}

export const initialState: SleepTimerState = {
  initialized: false,
  sleepTimer: DEFAULT_SLEEP_TIMER_SECONDS,
  sleepTimerEnabled: DEFAULT_SLEEP_TIMER_ENABLED,
  sleepTimerMotionDetectionEnabled:
    DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  sleepTimerTriggerTime: null,

  // Playback state
  playing: false,

  // Activity tracking
  isStationary: null,
};

export const useSleepTimer = create<SleepTimerState>()(() => initialState);

/**
 * Selector: Returns true when motion detection is actively preventing
 * the timer from running (i.e., timer would run if user were stationary).
 */
export function selectIsMotionPausingTimer(state: SleepTimerState): boolean {
  return (
    state.playing &&
    state.sleepTimerEnabled &&
    state.sleepTimerMotionDetectionEnabled &&
    state.isStationary === false
  );
}

/**
 * Internal: Set trigger time (called from sleep timer service)
 *
 * NOTE: Trigger time is NOT persisted to DB. It's transient runtime state
 * that survives app "kills" because the JS context persists (TrackPlayer's
 * foreground service keeps it alive). See CLAUDE.md for details.
 */
export function setTriggerTime(triggerTime: number | null) {
  useSleepTimer.setState({ sleepTimerTriggerTime: triggerTime });
}

/**
 * Reset store to initial state for testing.
 */
export function resetForTesting() {
  useSleepTimer.setState(initialState, true);
}
