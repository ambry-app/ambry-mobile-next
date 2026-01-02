import { create } from "zustand";

import { defaultSleepTimer, defaultSleepTimerEnabled } from "@/db/schema";

export interface SleepTimerState {
  initialized: boolean;
  sleepTimer: number; // Duration in seconds
  sleepTimerEnabled: boolean; // Whether enabled
  sleepTimerTriggerTime: number | null; // Unix timestamp in milliseconds (in-memory only)
}

export const useSleepTimer = create<SleepTimerState>()(() => ({
  initialized: false,
  sleepTimer: defaultSleepTimer,
  sleepTimerEnabled: defaultSleepTimerEnabled,
  sleepTimerTriggerTime: null,
}));

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
