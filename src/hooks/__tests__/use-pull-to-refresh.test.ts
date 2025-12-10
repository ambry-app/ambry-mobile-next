import { act, renderHook } from "@testing-library/react-native";

import * as syncModule from "@/db/sync";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";

// Set up a fresh test DB for each test
setupTestDatabase();

describe("usePullToRefresh", () => {
  let syncDownSpy: jest.SpyInstance | undefined;
  let syncPlaythroughsSpy: jest.SpyInstance | undefined;

  afterEach(() => {
    syncDownSpy?.mockRestore();
    syncPlaythroughsSpy?.mockRestore();
    syncDownSpy = undefined;
    syncPlaythroughsSpy = undefined;
  });

  it("refreshing is false initially", () => {
    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));
    expect(result.current.refreshing).toBe(false);
  });

  it("refreshing is true during onRefresh, then false after", async () => {
    // Patch syncDown and syncPlaythroughs to delay
    syncDownSpy = jest
      .spyOn(syncModule, "syncDown")
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [undefined, undefined];
      });
    syncPlaythroughsSpy = jest
      .spyOn(syncModule, "syncPlaythroughs")
      .mockImplementation(async () => {});

    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));

    // Call onRefresh but do not await
    void result.current.onRefresh();
    // Yield to event loop to allow state update
    await act(async () => {});
    // Now refreshing should be true
    expect(result.current.refreshing).toBe(true);
    // Wait for refresh to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
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
