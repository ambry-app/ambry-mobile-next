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
  sleepTimer: number; // Duration in seconds
  sleepTimerEnabled: boolean; // Whether enabled
  sleepTimerTriggerTime: number | null; // Unix timestamp (runtime only, not persisted)
}

export const useSleepTimer = create<SleepTimerState>()(() => ({
  sleepTimer: defaultSleepTimer,
  sleepTimerEnabled: defaultSleepTimerEnabled,
  sleepTimerTriggerTime: null,
}));

/**
 * Load sleep timer settings from database on boot
 */
export async function loadSleepTimerSettings(session: Session) {
  const settings = await getSleepTimerSettings(session.email);
  useSleepTimer.setState({
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
    sleepTimerTriggerTime: null, // Never persisted
  });
}

/**
 * Update enabled state (saves to DB and emits event)
 */
export async function setSleepTimerState(session: Session, enabled: boolean) {
  useSleepTimer.setState({
    sleepTimerEnabled: enabled,
    sleepTimerTriggerTime: null, // Reset trigger time
  });

  await setSleepTimerEnabled(session.email, enabled);

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

  await setSleepTimerTime(session.email, seconds);

  // If timer is currently active, notify service to reset with new duration
  const { sleepTimerTriggerTime } = useSleepTimer.getState();
  if (sleepTimerTriggerTime !== null) {
    EventBus.emit("sleepTimerChanged");
  }
}

/**
 * Internal: Set trigger time (called from playback service)
 */
export function setTriggerTime(triggerTime: number | null) {
  useSleepTimer.setState({ sleepTimerTriggerTime: triggerTime });
}
