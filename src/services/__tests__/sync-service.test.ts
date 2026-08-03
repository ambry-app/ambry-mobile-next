/**
 * Tests for the sync service.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real sync service, GraphQL API, and database code runs.
 */

import {
  firstSyncError,
  sync,
  SyncErrorCode,
  syncLibrary,
  syncPlaybackEvents,
} from "@/services/sync-service";
import {
  resetForTesting as resetDataVersionStore,
  useDataVersion,
} from "@/stores/data-version";
import {
  resetForTesting as resetDeviceStore,
  useDevice,
} from "@/stores/device";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import {
  resetForTesting as resetSyncProgressStore,
  SyncStage,
  SyncTask,
  useSyncProgress,
} from "@/stores/sync-progress";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  getGraphQLVariables,
  graphqlSuccess,
  graphqlUnauthorized,
  installFetchMock,
  mockGraphQL,
  mockNetworkError,
} from "@test/fetch-mock";
import {
  createLibraryBook,
  createLibraryPerson,
  emptyLibraryChanges,
  emptySyncEventsResult,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

// =============================================================================
// Test Setup
// =============================================================================

setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Set up stores with test-specific initial state.
 * We reset to initial state first, then set the values we need for sync tests.
 */
function setupStores() {
  resetSessionStore();
  resetDataVersionStore();
  resetDeviceStore();
  resetSyncProgressStore();

  useSession.setState({ session });
  useDataVersion.setState({
    initialized: false,
    libraryDataVersion: null,
    playthroughDataVersion: 0,
    shelfDataVersion: 0,
  });
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
}

describe("sync-service", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    setupStores();
    mockFetch = installFetchMock();
    resetSyncFixtureIdCounter();
  });

  // ===========================================================================
  // sync
  // ===========================================================================

  describe("sync (orchestration)", () => {
    it("completes successfully when sync succeeds", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));
      mockGraphQL(mockFetch, graphqlSuccess(emptySyncEventsResult(serverTime)));

      const result = await sync(session);

      expect(result.library.success).toBe(true);
      expect(result.events.success).toBe(true);
      expect(firstSyncError(result)).toBeNull();
    });

    it("reports a network failure instead of throwing", async () => {
      mockNetworkError(mockFetch);
      mockNetworkError(mockFetch);

      const result = await sync(session);

      expect(firstSyncError(result)?.code).toBe(SyncErrorCode.NETWORK);
    });

    it("reports a database failure instead of throwing", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";

      // A library payload the local schema cannot store: `id` is NOT NULL, so
      // applying these changes throws inside the transaction.
      mockGraphQL(
        mockFetch,
        graphqlSuccess({
          ...emptyLibraryChanges(serverTime),
          peopleChangedSince: [
            { ...createLibraryPerson(), id: null as unknown as string },
          ],
        }),
      );
      mockGraphQL(mockFetch, graphqlSuccess(emptySyncEventsResult(serverTime)));

      const result = await sync(session);

      expect(result.library.success).toBe(false);
      expect(firstSyncError(result)?.code).toBe(SyncErrorCode.UNEXPECTED);
    });
  });

  // ===========================================================================
  // Progress reporting
  // ===========================================================================

  describe("sync progress", () => {
    it("names each step and counts rows as the library is written", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";
      const people = Array.from({ length: 3 }, (_, i) =>
        createLibraryPerson({ id: `person-${i}` }),
      );
      const books = Array.from({ length: 2 }, (_, i) =>
        createLibraryBook({ id: `book-${i}` }),
      );

      // Record every report rather than the end state, since the point is that
      // progress is visible *during* the write
      const reports: { detail: string; current: number; total: number }[] = [];
      const unsubscribe = useSyncProgress.subscribe((state) => {
        const { stage, detail, current, total } = state.tasks[SyncTask.LIBRARY];
        if (stage === SyncStage.SAVING && detail) {
          reports.push({ detail, current, total });
        }
      });

      mockGraphQL(
        mockFetch,
        graphqlSuccess({
          ...emptyLibraryChanges(serverTime),
          peopleChangedSince: people,
          booksChangedSince: books,
        }),
      );
      mockGraphQL(mockFetch, graphqlSuccess(emptySyncEventsResult(serverTime)));

      await syncLibrary(session);
      unsubscribe();

      expect(reports.map((r) => r.detail)).toEqual([
        "people",
        "people",
        "books",
        "books",
      ]);
      // Every report counts against the whole write, not just the current step
      expect(reports.every((r) => r.total === 5)).toBe(true);
      expect(reports.map((r) => r.current)).toEqual([0, 3, 3, 5]);
    });

    it("moves the library task through downloading to done", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";
      const stages: SyncStage[] = [];
      const unsubscribe = useSyncProgress.subscribe((state) => {
        const { stage } = state.tasks[SyncTask.LIBRARY];
        if (stages[stages.length - 1] !== stage) stages.push(stage);
      });

      mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));

      await syncLibrary(session);
      unsubscribe();

      expect(stages).toEqual([SyncStage.DOWNLOADING, SyncStage.DONE]);
    });

    it("marks the task failed when the sync fails", async () => {
      mockNetworkError(mockFetch);

      await syncLibrary(session);

      expect(useSyncProgress.getState().tasks[SyncTask.LIBRARY].stage).toBe(
        SyncStage.FAILED,
      );
    });
  });

  // ===========================================================================
  // syncLibrary
  // ===========================================================================

  describe("syncLibrary", () => {
    it("updates libraryDataVersion store after sync", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));

      await syncLibrary(session);

      const { libraryDataVersion } = useDataVersion.getState();
      expect(libraryDataVersion).toBe(new Date(serverTime).getTime());
    });

    it("clears session on unauthorized error", async () => {
      mockGraphQL(mockFetch, graphqlUnauthorized());

      await syncLibrary(session);

      // Session should be cleared
      const { session: currentSession } = useSession.getState();
      expect(currentSession).toBeNull();
    });

    it("re-fetches the entire library when fullResync is set", async () => {
      const firstServerTime = "2024-01-15T10:00:00.000Z";
      const secondServerTime = "2024-01-16T10:00:00.000Z";
      const thirdServerTime = "2024-01-17T10:00:00.000Z";

      // First sync stores the cursor
      mockGraphQL(
        mockFetch,
        graphqlSuccess(emptyLibraryChanges(firstServerTime)),
      );
      await syncLibrary(session);

      // A normal second sync sends the stored cursor
      mockGraphQL(
        mockFetch,
        graphqlSuccess(emptyLibraryChanges(secondServerTime)),
      );
      await syncLibrary(session);
      expect(getGraphQLVariables(mockFetch, 1)?.since).toBe(firstServerTime);

      // A full resync ignores the stored cursor and asks for everything
      mockGraphQL(
        mockFetch,
        graphqlSuccess(emptyLibraryChanges(thirdServerTime)),
      );
      await syncLibrary(session, { fullResync: true });
      expect(getGraphQLVariables(mockFetch, 2)?.since).toBeNull();

      // The data version advances to the new server time even with no changes
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        new Date(thirdServerTime).getTime(),
      );
    });
  });

  // ===========================================================================
  // syncPlaythroughs
  // ===========================================================================

  describe("syncPlaythroughs", () => {
    it("clears session on unauthorized error", async () => {
      mockGraphQL(mockFetch, graphqlUnauthorized());

      await syncPlaybackEvents(session);

      // Session should be cleared
      const { session: currentSession } = useSession.getState();
      expect(currentSession).toBeNull();
    });

    it("bumps playthroughDataVersion on successful sync", async () => {
      const serverTime = "2024-01-01T00:00:00.000Z";

      mockGraphQL(mockFetch, graphqlSuccess(emptySyncEventsResult(serverTime)));

      const initialPlaythroughVersion =
        useDataVersion.getState().playthroughDataVersion;

      await syncPlaybackEvents(session);

      const newPlaythroughVersion =
        useDataVersion.getState().playthroughDataVersion;

      expect(newPlaythroughVersion).not.toBe(initialPlaythroughVersion);
      expect(typeof newPlaythroughVersion).toBe("number");
    });
  });
});
