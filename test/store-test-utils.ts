/**
 * Test utilities for Zustand stores.
 * Zustand stores are singletons, so state persists across tests unless reset.
 */
import type { StoreApi } from "zustand";

/**
 * Reset a Zustand store to its initial state before each test.
 * Call this at the top level of your describe block.
 *
 * @example
 * describe("my store tests", () => {
 *   resetStoreBeforeEach(useMyStore, { count: 0, initialized: false });
 *
 *   it("does something", () => {
 *     // Store starts fresh with initial state
 *   });
 * });
 */
export function resetStoreBeforeEach<T>(
  store: StoreApi<T>,
  initialState: T,
): void {
  beforeEach(() => {
    store.setState(initialState, true); // true = replace entire state
  });
}
