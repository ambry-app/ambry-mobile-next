/**
 * Tests for the app boot sequence.
 *
 * Uses Detroit-style testing: the real sync service, GraphQL API, stores and
 * database code runs. Only boundaries are mocked - `fetch`, the native modules
 * faked in jest-setup, and `useDatabaseMigrations`, which drives drizzle's
 * expo-sqlite migrator against a native database the test db does not have.
 */

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { BootErrorKind, useAppBoot } from "@/services/boot-service";
import { resetForTesting as resetSleepTimerService } from "@/services/sleep-timer-service";
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import { resetForTesting as resetDataVersionStore } from "@/stores/data-version";
import {
  resetForTesting as resetDeviceStore,
  useDevice,
} from "@/stores/device";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  graphqlUnauthorized,
  installFetchMock,
  mockGraphQL,
  mockNetworkError,
} from "@test/fetch-mock";
import {
  createLibraryPerson,
  emptyLibraryChanges,
  emptySyncEventsResult,
} from "@test/sync-fixtures";

jest.mock("@/services/db-service", () => ({
  useDatabaseMigrations: () => ({ success: true, error: undefined }),
  performWalCheckpoint: jest.fn(),
}));

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/** Answer both halves of a sync successfully, with the given library payload. */
function mockSuccessfulSync(
  mockFetch: ReturnType<typeof installFetchMock>,
  serverTime: string,
  changes: Partial<ReturnType<typeof emptyLibraryChanges>> = {},
) {
  mockFetch.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      const data = body.query?.includes("query LibraryChangesSince")
        ? { ...emptyLibraryChanges(serverTime), ...changes }
        : emptySyncEventsResult(serverTime);

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
}

describe("boot-service", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    mockFetch = installFetchMock();

    resetSessionStore();
    resetDataVersionStore();
    resetDeviceStore();

    useSession.setState({ session });
    useDevice.setState({
      initialized: true,
      deviceInfo: {
        id: "test-device-id",
        type: "android" as const,
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

  afterEach(() => {
    resetTrackPlayerService();
    resetSleepTimerService();
  });

  it("finishes boot when the initial sync succeeds", async () => {
    const serverTime = "2024-01-15T10:00:00.000Z";
    mockSuccessfulSync(mockFetch, serverTime);

    const { result } = renderHook(() => useAppBoot());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.initialSyncComplete).toBe(true);
    expect(result.current.bootError).toBeNull();
  });

  it("reports an error rather than waiting forever when the initial sync fails", async () => {
    mockNetworkError(mockFetch);
    mockNetworkError(mockFetch);

    const { result } = renderHook(() => useAppBoot());

    await waitFor(() => expect(result.current.bootError).not.toBeNull());
    expect(result.current.bootError?.kind).toBe(BootErrorKind.NETWORK);
    // isReady has to flip too, or the app sits on the splash screen instead of
    // rendering the error
    expect(result.current.isReady).toBe(true);
    expect(result.current.initialSyncComplete).toBe(false);
  });

  it("actually re-runs the outstanding initial sync when retried", async () => {
    const db = getDb();

    mockNetworkError(mockFetch);
    mockNetworkError(mockFetch);

    const { result } = renderHook(() => useAppBoot());
    await waitFor(() => expect(result.current.bootError).not.toBeNull());

    // The library never synced, so nothing was stored
    expect(await db.query.people.findMany()).toHaveLength(0);

    mockSuccessfulSync(mockFetch, "2024-01-15T10:00:00.000Z", {
      peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
    });

    act(() => result.current.retryBoot());

    await waitFor(() => expect(result.current.initialSyncComplete).toBe(true));
    expect(result.current.bootError).toBeNull();

    // The retry has to perform the sync it skipped, not just declare success
    expect(await db.query.people.findMany()).toHaveLength(1);
  });

  it("does not show an error when the server rejects the session", async () => {
    mockGraphQL(mockFetch, graphqlUnauthorized());
    mockGraphQL(mockFetch, graphqlUnauthorized());

    const { result } = renderHook(() => useAppBoot());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    // The cleared session sends the user back to sign-in on its own
    expect(useSession.getState().session).toBeNull();
    expect(result.current.bootError).toBeNull();
  });
});
