/**
 * Tests for sync hooks.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real sync service and hooks run.
 */

import { act, renderHook } from "@testing-library/react-native";

import { usePullToRefresh } from "@/services/sync-service";
import { useDevice } from "@/stores/device";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  graphqlSuccess,
  installFetchMock,
  mockGraphQL,
} from "@test/fetch-mock";
import {
  emptyLibraryChanges,
  emptySyncProgressResult,
} from "@test/sync-fixtures";

// Set up a fresh test DB for each test
setupTestDatabase();

describe("usePullToRefresh", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    mockFetch = installFetchMock();

    // Set up device store (needed for syncPlaythroughs)
    useDevice.setState({
      initialized: true,
      deviceInfo: {
        id: "test-device-id",
        type: "android",
        brand: "TestBrand",
        modelName: "TestModel",
        osName: "Android",
        osVersion: "14",
        appId: "app.ambry.mobile.dev",
        appVersion: "1.0.0",
        appBuild: "1",
      },
    });
  });

  it("refreshing is false initially", () => {
    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));
    expect(result.current.refreshing).toBe(false);
  });

  it("refreshing is true during onRefresh, then false after", async () => {
    // Create controlled promises for network responses
    let resolveLibrarySync!: (value: Response) => void;
    let resolvePlaythroughSync!: (value: Response) => void;

    const libraryPromise = new Promise<Response>((resolve) => {
      resolveLibrarySync = resolve;
    });
    const playthroughPromise = new Promise<Response>((resolve) => {
      resolvePlaythroughSync = resolve;
    });

    // Mock fetch to return controlled promises
    mockFetch
      .mockReturnValueOnce(libraryPromise)
      .mockReturnValueOnce(playthroughPromise);

    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));

    // Start the refresh
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.onRefresh();
    });

    // Now refreshing should be true (network calls are blocked)
    expect(result.current.refreshing).toBe(true);

    // Create success responses
    const serverTime = new Date().toISOString();
    const libraryResponse = new Response(
      JSON.stringify({ data: emptyLibraryChanges(serverTime) }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    const playthroughResponse = new Response(
      JSON.stringify({
        data: { syncProgress: emptySyncProgressResult(serverTime) },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    // Release the network calls and wait for completion
    await act(async () => {
      resolveLibrarySync(libraryResponse);
      resolvePlaythroughSync(playthroughResponse);
      await refreshPromise;
    });

    // Should be false after
    expect(result.current.refreshing).toBe(false);
  });

  it("runs the real sync logic and completes successfully", async () => {
    const serverTime = new Date().toISOString();

    // Mock successful responses for both sync operations
    mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));
    mockGraphQL(
      mockFetch,
      graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
    );

    const { result } = renderHook(() => usePullToRefresh(DEFAULT_TEST_SESSION));

    await act(async () => {
      await result.current.onRefresh();
    });

    // Should be false after successful sync
    expect(result.current.refreshing).toBe(false);
  });
});
