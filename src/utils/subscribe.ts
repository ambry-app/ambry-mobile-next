/**
 * Subscribe to changes in a specific piece of Zustand store state.
 *
 * @param store - The Zustand store to subscribe to
 * @param selector - Function to extract the value to watch
 * @param callback - Called when the selected value changes
 * @returns Unsubscribe function
 */
export function subscribeToChange<S, T>(
  store: {
    subscribe: (listener: (state: S, prevState: S) => void) => () => void;
  },
  selector: (state: S) => T,
  callback: (value: T, prevValue: T) => void,
): () => void {
  return store.subscribe((state, prevState) => {
    const value = selector(state);
    const prevValue = selector(prevState);
    if (!Object.is(value, prevValue)) {
      callback(value, prevValue);
    }
  });
}
