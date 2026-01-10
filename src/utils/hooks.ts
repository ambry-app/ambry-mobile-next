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
  const lastExecuted = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
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
