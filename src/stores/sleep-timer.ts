import { defaultSleepTimer, defaultSleepTimerEnabled } from "@/src/db/schema";
import {
  getSleepTimerSettings,
  setSleepTimerEnabled,
  setSleepTimerTime,
  setSleepTimerTriggerTime,
} from "@/src/db/settings";
import { EventBus } from "@/src/utils";
import { create } from "zustand";
import { Session } from "./session";

export interface SleepTimerState {
  sleepTimer: number; // Duration in seconds
  sleepTimerEnabled: boolean; // Whether enabled
  sleepTimerTriggerTime: number | null; // Unix timestamp in milliseconds (persisted)
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

  // Check if trigger time is still valid (hasn't passed yet)
  let triggerTime = settings.sleepTimerTriggerTime;
  if (triggerTime !== null && triggerTime <= Date.now()) {
    // Trigger time has passed, clear it
    triggerTime = null;
    await setSleepTimerTriggerTime(session.email, null);
  }

  useSleepTimer.setState({
    sleepTimer: settings.sleepTimer,
    sleepTimerEnabled: settings.sleepTimerEnabled,
    sleepTimerTriggerTime: triggerTime,
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
  await setSleepTimerTriggerTime(session.email, null); // Reset persisted trigger time

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
export async function setTriggerTime(
  session: Session | null,
  triggerTime: number | null,
) {
  useSleepTimer.setState({ sleepTimerTriggerTime: triggerTime });

  // Persist to database so it survives app restarts
  if (session) {
    await setSleepTimerTriggerTime(session.email, triggerTime);
  }
}
