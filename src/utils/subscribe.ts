/**
 * Subscribe to changes in a specific piece of Zustand store state.
 *
 * @param store - The Zustand store to subscribe to
 * @param selector - Function to extract the value to watch
 * @param callback - Called when the selected value changes
 * @returns Unsubscribe function
 *
 * ## Deduplication
 *
 * When `setState` is called from within a Zustand subscription callback,
 * subscribers get notified twice for the same change. We guard against this by
 * tracking the last value we fired for. This works for both objects (same
 * reference) and primitives (same value).
 */
export function subscribeToChange<S, T>(
  store: {
    subscribe: (listener: (state: S, prevState: S) => void) => () => void;
  },
  selector: (state: S) => T,
  callback: (value: T, prevValue: T) => void,
): () => void {
  let lastFiredValue: T | undefined;

  return store.subscribe((state, prevState) => {
    const value = selector(state);
    const prevValue = selector(prevState);

    // Check if value changed AND we haven't already fired for this exact value
    // (the second check guards against the nested setState double-notification)
    if (!Object.is(value, prevValue) && value !== lastFiredValue) {
      lastFiredValue = value;
      callback(value, prevValue);
    }
  });
}
