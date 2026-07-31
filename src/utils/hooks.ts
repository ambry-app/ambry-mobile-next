/**
 * Pure React utility hooks.
 *
 * These are generic React patterns with no business logic or external dependencies.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, BackHandler } from "react-native";
import { router } from "expo-router";

import { logBase } from "@/utils/logger";

const log = logBase.extend("app-state");

// =============================================================================
// useMenuState
// =============================================================================

/**
 * Open/closed state for a Jetpack Compose `DropdownMenu`.
 *
 * As of SDK 57 the native menu no longer opens itself when its trigger is
 * pressed — `expanded` is driven entirely from JS. Every menu therefore has to
 * open on trigger press, close on dismiss, and close itself when an item is
 * chosen; wrap item handlers in `selecting()` to get the last part.
 */
export function useMenuState() {
  const [expanded, setExpanded] = useState(false);

  const open = useCallback(() => setExpanded(true), []);
  const close = useCallback(() => setExpanded(false), []);
  const selecting = useCallback(
    (action: () => void) => () => {
      setExpanded(false);
      action();
    },
    [],
  );

  return { expanded, open, close, selecting };
}

// =============================================================================
// useSyncedState
// =============================================================================

/**
 * Local, editable state that follows an external value, resetting whenever that
 * value changes.
 *
 * Use this instead of `useState` + `useEffect(() => setLocal(source), [source])`.
 * The effect version renders once with the stale value and then again with the
 * new one; adjusting during render (React's documented pattern for "resetting
 * state when a prop changes") re-renders before anything is painted, and keeps
 * the React Compiler's `set-state-in-effect` rule satisfied.
 */
export function useSyncedState<T>(
  source: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState(source);
  const [previousSource, setPreviousSource] = useState(source);

  if (source !== previousSource) {
    setPreviousSource(source);
    setValue(source);
  }

  return [value, setValue];
}

// =============================================================================
// useDebounce
// =============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// =============================================================================
// useThrottle
// =============================================================================

export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  // Seeded on the first effect run rather than during render, which keeps the
  // original behaviour (mount counts as the last execution) without reading the
  // clock while rendering.
  const lastExecuted = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    lastExecuted.current ??= now;
    const timeSinceLast = now - lastExecuted.current;

    if (timeSinceLast >= delay) {
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      const timeout = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, delay - timeSinceLast);

      return () => clearTimeout(timeout);
    }
  }, [value, delay]);

  return throttledValue;
}

// =============================================================================
// useAppState
// =============================================================================

export function useAppState() {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  useEffect(() => {
    const onChange = async (newAppState: AppStateStatus) => {
      log.debug("Changed to", newAppState);
      setAppState(newAppState);
    };

    const subscription = AppState.addEventListener("change", onChange);

    return () => subscription.remove();
  }, []);

  return appState;
}

// =============================================================================
// useBackHandler
// =============================================================================

export function useBackHandler(handler: () => boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);

    return () => sub.remove();
  }, [handler]);
}

// =============================================================================
// useNavigateToBookCallback
// =============================================================================

type Book = {
  id: string;
  title: string;
};

type Media = {
  id: string;
};

export function useNavigateToBookCallback(book: Book, media: Media[]) {
  return useCallback(() => {
    if (media[0] && media.length === 1) {
      router.navigate({
        pathname: "/media/[id]",
        params: {
          id: media[0].id,
          title: book.title,
        },
      });
    } else {
      router.navigate({
        pathname: "/book/[id]",
        params: { id: book.id, title: book.title },
      });
    }
  }, [book, media]);
}
