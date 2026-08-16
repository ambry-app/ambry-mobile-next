/**
 * Background Timer
 *
 * A drop-in replacement for `setTimeout` / `setInterval` that keeps counting
 * while the app is backgrounded.
 *
 * On Android, React Native drives JS timers from a choreographer frame callback
 * that `JavaTimerManager.onHostPause` unhooks whenever the Activity pauses -
 * Home press, screen off, or swipe away. Every `setTimeout` and `setInterval`
 * freezes there and fires only on `onHostResume`, all overdue ones at once.
 * Audio keeps playing throughout, so anything time-driven that matters to
 * playback - the sleep timer, the position heartbeat, seek accumulation -
 * silently stops. This module schedules on a native `Handler` instead and
 * delivers each fire as an event, which reaches JS regardless of Activity
 * state.
 *
 * On every other platform this delegates to the JS timers, which is not a
 * stopgap: iOS keeps the whole app running under `UIBackgroundModes: ["audio"]`,
 * so its timers already tick in the background and there is nothing to fix. The
 * API is the same on both so callers never branch on platform.
 *
 * The scheduling backend is the only part that differs. The callback table and
 * dispatch below are shared, so a handle means the same thing everywhere.
 */

import { Platform } from "react-native";
import { NativeModule, requireNativeModule } from "expo";

import {
  BackgroundTimerEvents,
  BackgroundTimerHandle,
} from "./BackgroundTimer.types";

// =============================================================================
// Callback table
// =============================================================================

type Registration = {
  callback: () => void;
  repeating: boolean;
};

const registrations = new Map<BackgroundTimerHandle, Registration>();

let nextHandle = 1;

/**
 * Run the callback for a fired timer.
 *
 * A handle with no registration has been cancelled since the fire was
 * scheduled - a race the native path can lose by a message-queue hop - so
 * dropping it is the whole of the fix.
 */
function fire(handle: BackgroundTimerHandle) {
  const registration = registrations.get(handle);
  if (!registration) return;

  if (!registration.repeating) {
    registrations.delete(handle);
  }

  registration.callback();
}

// =============================================================================
// Backends
// =============================================================================

type Backend = {
  schedule: (handle: BackgroundTimerHandle, delayMs: number) => void;
  scheduleInterval: (handle: BackgroundTimerHandle, everyMs: number) => void;
  cancel: (handle: BackgroundTimerHandle) => void;
};

declare class BackgroundTimerNativeModule extends NativeModule<BackgroundTimerEvents> {
  schedule(id: number, delayMs: number): void;
  scheduleInterval(id: number, everyMs: number): void;
  cancel(id: number): void;
  cancelAll(): void;
}

function createNativeBackend(): Backend {
  const native =
    requireNativeModule<BackgroundTimerNativeModule>("BackgroundTimer");

  native.addListener("onTimerFired", ({ id }) => fire(id));

  return {
    schedule: (handle, delayMs) => native.schedule(handle, delayMs),
    scheduleInterval: (handle, everyMs) =>
      native.scheduleInterval(handle, everyMs),
    cancel: (handle) => native.cancel(handle),
  };
}

function createJsBackend(): Backend {
  const timers = new Map<
    BackgroundTimerHandle,
    ReturnType<typeof setTimeout>
  >();
  const intervals = new Map<
    BackgroundTimerHandle,
    ReturnType<typeof setInterval>
  >();

  return {
    schedule: (handle, delayMs) => {
      // Called through the global rather than a captured reference so that a
      // test's fake timers, installed after this module loads, still apply.
      timers.set(
        handle,
        setTimeout(() => {
          timers.delete(handle);
          fire(handle);
        }, delayMs),
      );
    },

    scheduleInterval: (handle, everyMs) => {
      intervals.set(
        handle,
        setInterval(() => fire(handle), everyMs),
      );
    },

    cancel: (handle) => {
      const timer = timers.get(handle);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(handle);
      }

      const interval = intervals.get(handle);
      if (interval !== undefined) {
        clearInterval(interval);
        intervals.delete(handle);
      }
    },
  };
}

let backend: Backend | null = null;

/**
 * Resolved on first use rather than at import, so that importing this module
 * never requires the native one on a platform that does not ship it.
 */
function getBackend(): Backend {
  backend ??=
    Platform.OS === "android" ? createNativeBackend() : createJsBackend();
  return backend;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Run `callback` once, `delayMs` from now. The equivalent of `setTimeout`.
 */
export function schedule(
  callback: () => void,
  delayMs: number,
): BackgroundTimerHandle {
  const handle = nextHandle++;
  registrations.set(handle, { callback, repeating: false });
  getBackend().schedule(handle, delayMs);
  return handle;
}

/**
 * Run `callback` every `everyMs` until cancelled. The equivalent of
 * `setInterval`.
 *
 * Ticks are spaced from the end of the previous one, so a tick delayed by a
 * busy device is not followed by a burst of catch-up ticks.
 */
export function scheduleInterval(
  callback: () => void,
  everyMs: number,
): BackgroundTimerHandle {
  const handle = nextHandle++;
  registrations.set(handle, { callback, repeating: true });
  getBackend().scheduleInterval(handle, everyMs);
  return handle;
}

/**
 * Stop a timer. Accepts null so callers can cancel an optional handle without
 * a guard, and is a no-op for a one-shot that has already fired.
 */
export function cancel(handle: BackgroundTimerHandle | null | undefined): void {
  if (handle === null || handle === undefined) return;

  registrations.delete(handle);
  getBackend().cancel(handle);
}

/**
 * Wait `ms`, then resolve. The awaitable form, for polling loops.
 *
 * A bare `await new Promise((resolve) => setTimeout(resolve, ms))` inside an
 * async function is the same trap as any other JS timer: backgrounded, the
 * promise never settles and everything awaiting it hangs until the app is
 * reopened.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    schedule(() => resolve(), ms);
  });
}

export * from "./BackgroundTimer.types";
