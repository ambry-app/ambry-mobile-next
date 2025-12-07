import { db } from "@/src/db/db";
import { defaultSleepTimer, defaultSleepTimerEnabled } from "@/src/db/schema";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled,
  setSleepTimerTime,
} from "@/src/db/settings";
import { EventBus } from "@/src/utils";
import { create } from "zustand";
import { Session } from "./session";

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
 * Initialize the sleep timer store.
 * Loads user preferences from DB if not already initialized (context may have persisted).
 *
 * NOTE: Only loads user preferences (duration, enabled). Does NOT touch
 * sleepTimerTriggerTime because it's transient runtime state that survives
 * in the persistent JS context. See CLAUDE.md for details.
 */
export async function initializeSleepTimer(session: Session) {
  if (useSleepTimer.getState().initialized) {
    console.debug("[SleepTimer] Already initialized, skipping");
    return;
  }

  console.debug("[SleepTimer] Initializing");

  const settings = await getSleepTimerSettings(db, session.email);

  useSleepTimer.setState({
    initialized: true,
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
    // NOTE: intentionally NOT setting sleepTimerTriggerTime here
  });
}

/**
 * Update enabled state (saves to DB and emits event)
 */
export async function setSleepTimerState(session: Session, enabled: boolean) {
  useSleepTimer.setState({
    sleepTimerEnabled: enabled,
    sleepTimerTriggerTime: null, // Reset trigger time in memory
  });

  await setSleepTimerEnabled(db, session.email, enabled);

  if (enabled) {
    EventBus.emit("sleepTimerEnabled");
  } else {
    EventBus.emit("sleepTimerDisabled");
  }
}

/**
 * Update duration (saves to DB and emits event if timer is active)
 */
export async function setSleepTimer(session: Session, seconds: number) {
  useSleepTimer.setState({ sleepTimer: seconds });

  await setSleepTimerTime(db, session.email, seconds);

  // If timer is currently active, notify service to reset with new duration
  const { sleepTimerTriggerTime } = useSleepTimer.getState();
  if (sleepTimerTriggerTime !== null) {
    EventBus.emit("sleepTimerChanged");
  }
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
