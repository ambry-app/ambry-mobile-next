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

  // Motion detection state (for debug display)
  motionVariance: number; // Last detected variance
  lastMotionDetected: number | null; // Timestamp of last motion-triggered reset
}

export const initialState: SleepTimerState = {
  initialized: false,
  sleepTimer: DEFAULT_SLEEP_TIMER_SECONDS,
  sleepTimerEnabled: DEFAULT_SLEEP_TIMER_ENABLED,
  sleepTimerMotionDetectionEnabled:
    DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  sleepTimerTriggerTime: null,

  // Motion detection
  motionVariance: 0,
  lastMotionDetected: null,
};

export const useSleepTimer = create<SleepTimerState>()(() => initialState);

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
