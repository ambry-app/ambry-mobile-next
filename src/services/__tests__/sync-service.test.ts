/**
 * Tests for the sync service.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real sync service, GraphQL API, and database code runs.
 */

import { sync, syncLibrary, syncPlaythroughs } from "@/services/sync-service";
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
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  graphqlSuccess,
  graphqlUnauthorized,
  installFetchMock,
  mockGraphQL,
} from "@test/fetch-mock";
import {
  emptyLibraryChanges,
  emptySyncProgressResult,
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
      mockGraphQL(
        mockFetch,
        graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
      );

      const result = await sync(session);

      expect(result).toEqual([undefined, undefined]);
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
  });

  // ===========================================================================
  // syncPlaythroughs
  // ===========================================================================

  describe("syncPlaythroughs", () => {
    it("clears session on unauthorized error", async () => {
      mockGraphQL(mockFetch, graphqlUnauthorized());

      await syncPlaythroughs(session);

      // Session should be cleared
      const { session: currentSession } = useSession.getState();
      expect(currentSession).toBeNull();
    });

    it("bumps playthroughDataVersion on successful sync", async () => {
      const serverTime = "2024-01-01T00:00:00.000Z";

      mockGraphQL(
        mockFetch,
        graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
      );

      const initialPlaythroughVersion =
        useDataVersion.getState().playthroughDataVersion;

      await syncPlaythroughs(session);

      const newPlaythroughVersion =
        useDataVersion.getState().playthroughDataVersion;

      expect(newPlaythroughVersion).not.toBe(initialPlaythroughVersion);
      expect(typeof newPlaythroughVersion).toBe("number");
    });
  });
});
