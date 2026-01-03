import { act, renderHook } from "@testing-library/react-native";

import { usePullToRefresh } from "@/services/sync-service";
import * as syncService from "@/services/sync-service";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";

// Set up a fresh test DB for each test
setupTestDatabase();

describe("usePullToRefresh", () => {
  let syncSpy: jest.SpyInstance | undefined;

  afterEach(() => {
    syncSpy?.mockRestore();
    syncSpy = undefined;
  });

  it("refreshing is false initially", () => {
    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));
    expect(result.current.refreshing).toBe(false);
  });

  it("refreshing is true during onRefresh, then false after", async () => {
    // Use a controlled promise so we can check state while sync is blocked
    let resolveSync!: () => void;
    const syncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });

    syncSpy = jest.spyOn(syncService, "sync").mockImplementation(async () => {
      await syncPromise;
      return [
        { success: true, result: "no_changes" },
        { success: true, result: "no_changes" },
      ];
    });

    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));

    // Start the refresh (wrap in act to flush state updates)
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.onRefresh();
    });

    // Now refreshing should be true (sync is blocked on our promise)
    expect(result.current.refreshing).toBe(true);

    // Release the sync and wait for completion
    await act(async () => {
      resolveSync();
      await refreshPromise;
    });

    // Should be false after
    expect(result.current.refreshing).toBe(false);
  });

  it("runs the real sync logic and does not throw", async () => {
    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));
    await act(async () => {
      if (typeof result.current.onRefresh === "function") {
        await result.current.onRefresh();
      } else {
        throw new Error("onRefresh is not a function");
      }
    });
    // Should be false after
    expect(result.current.refreshing).toBe(false);
    // Optionally: check DB state or side effects here
  });
});
