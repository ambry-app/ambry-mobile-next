/* eslint-disable import/first */
// Mock service dependencies - useDb imports need to be mocked before
// any modules that use them are imported, to prevent actual DB calls.
const mockGetDb = jest.fn();
jest.mock("@/db/db", () => ({
  getDb: () => mockGetDb(),
}));

const mockGetUnsyncedPlaythroughs = jest.fn();
const mockGetUnsyncedEvents = jest.fn();
const mockMarkPlaythroughsSynced = jest.fn();
const mockMarkEventsSynced = jest.fn();
jest.mock("@/db/playthroughs", () => ({
  getUnsyncedPlaythroughs: (...args: unknown[]) =>
    mockGetUnsyncedPlaythroughs(...args),
  getUnsyncedEvents: (...args: unknown[]) => mockGetUnsyncedEvents(...args),
  markPlaythroughsSynced: (...args: unknown[]) =>
    mockMarkPlaythroughsSynced(...args),
  markEventsSynced: (...args: unknown[]) => mockMarkEventsSynced(...args),
}));

// Mock GraphQL API calls
const mockGetLibraryChangesSince = jest.fn();
const mockSyncProgress = jest.fn();
jest.mock("@/graphql/api", () => ({
  getLibraryChangesSince: (...args: unknown[]) =>
    mockGetLibraryChangesSince(...args),
  syncProgress: (...args: unknown[]) => mockSyncProgress(...args),
  // Need to export the enums that sync.ts uses - using PascalCase keys like the real enums
  DeviceTypeInput: {
    Ios: "IOS",
    Android: "ANDROID",
  },
  PlaybackEventType: {
    Start: "START",
    Play: "PLAY",
    Pause: "PAUSE",
    Seek: "SEEK",
    RateChange: "RATE_CHANGE",
    Finish: "FINISH",
    Abandon: "ABANDON",
    Resume: "RESUME",
  },
  PlaythroughStatus: {
    InProgress: "IN_PROGRESS",
    Finished: "FINISHED",
    Abandoned: "ABANDONED",
  },
}));

const mockClearSession = jest.fn();
jest.mock("@/stores/session", () => ({
  useSession: jest.requireActual("@/stores/session").useSession,
  clearSession: () => mockClearSession(),
}));

// Mock stores
import { sync, syncLibrary, syncPlaythroughs } from "@/services/sync-service";
import { useDataVersion } from "@/stores/data-version";
import { useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import { resetStoreBeforeEach } from "@test/store-test-utils";
import {
  emptyLibraryChanges,
  emptySyncProgressResult,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

/* eslint-enable import/first */

// =============================================================================
// Mocks & Test Setup
// =============================================================================

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

const initialSessionState = { session };
const initialDataVersionState = {
  initialized: false,
  libraryDataVersion: null,
  playthroughDataVersion: 0,
  shelfDataVersion: 0,
};
const initialDeviceState = {
  initialized: false,
  deviceInfo: {
    id: "test-device-id",
    type: "android" as const,
    brand: "TestBrand",
    modelName: "TestModel",
    osName: "Android",
    osVersion: "14",
  },
};

resetStoreBeforeEach(useSession, initialSessionState);
resetStoreBeforeEach(useDataVersion, initialDataVersionState);
resetStoreBeforeEach(useDevice, initialDeviceState);

beforeEach(() => {
  mockGetDb.mockClear();
  mockGetLibraryChangesSince.mockClear();
  mockSyncProgress.mockClear();
  mockGetUnsyncedPlaythroughs.mockClear();
  mockGetUnsyncedEvents.mockClear();
  mockMarkPlaythroughsSynced.mockClear();
  mockMarkEventsSynced.mockClear();
  mockClearSession.mockClear();
  resetSyncFixtureIdCounter();

  // Default DB mock - just return an empty Drizzle instance
  mockGetDb.mockReturnValue(getDb());

  // Default return values for playthrough mocks
  mockGetUnsyncedPlaythroughs.mockResolvedValue([]);
  mockGetUnsyncedEvents.mockResolvedValue([]);
});

// =============================================================================
// sync
// =============================================================================

describe("sync (orchestration)", () => {
  it("calls syncLibrary and syncPlaythroughs in parallel", async () => {
    const serverTime = "2024-01-15T10:00:00.000Z";

    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(serverTime),
    });

    mockSyncProgress.mockResolvedValue({
      success: true,
      result: { syncProgress: emptySyncProgressResult(serverTime) },
    });

    await sync(session);

    expect(mockGetLibraryChangesSince).toHaveBeenCalledTimes(1);
    expect(mockSyncProgress).toHaveBeenCalledTimes(1);
  });

  it("completes successfully when sync succeeds", async () => {
    const serverTime = "2024-01-15T10:00:00.000Z";

    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(serverTime),
    });

    mockSyncProgress.mockResolvedValue({
      success: true,
      result: { syncProgress: emptySyncProgressResult(serverTime) },
    });

    const result = await sync(session);

    expect(result).toEqual([undefined, undefined]);
  });
});

// =============================================================================
// syncLibrary
// =============================================================================

describe("syncLibrary", () => {
  it("updates libraryDataVersion store after sync", async () => {
    const serverTime = "2024-01-15T10:00:00.000Z";

    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(serverTime),
    });

    await syncLibrary(session);

    const { libraryDataVersion } = useDataVersion.getState();
    expect(libraryDataVersion).toBe(new Date(serverTime).getTime());
  });

  it("calls clearSession on unauthorized error", async () => {
    mockGetLibraryChangesSince.mockResolvedValue({
      success: false,
      error: { code: "ExecuteAuthenticatedErrorCodeUnauthorized" },
    });

    await syncLibrary(session);

    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// syncPlaythroughs
// =============================================================================

describe("syncPlaythroughs", () => {
  it("calls clearSession on unauthorized error", async () => {
    // Ensure device is initialized
    useDevice.setState({
      initialized: true,
      deviceInfo: initialDeviceState.deviceInfo,
    });

    mockSyncProgress.mockResolvedValue({
      success: false,
      error: { code: "ExecuteAuthenticatedErrorCodeUnauthorized" },
    });

    await syncPlaythroughs(session);

    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it("bumps playthroughDataVersion on successful sync", async () => {
    // Ensure device is initialized
    useDevice.setState({
      initialized: true,
      deviceInfo: initialDeviceState.deviceInfo,
    });

    mockSyncProgress.mockResolvedValue({
      success: true,
      result: {
        syncProgress: emptySyncProgressResult("2024-01-01T00:00:00.000Z"),
      },
    });

    const initialPlaythroughVersion =
      useDataVersion.getState().playthroughDataVersion;
    await syncPlaythroughs(session);
    const newPlaythroughVersion =
      useDataVersion.getState().playthroughDataVersion;

    expect(newPlaythroughVersion).not.toBe(initialPlaythroughVersion);
    expect(typeof newPlaythroughVersion).toBe("number");
  });

  // Note: The "returns early if device not initialized" test was removed because
  // getDeviceInfo() auto-initializes the device. Device initialization is handled
  // at the device store level, not in syncPlaythroughs.
});
