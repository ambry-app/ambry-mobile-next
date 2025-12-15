// Import the service module AFTER mocks are set up
// This ensures defineTask callback is captured
import {
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
} from "@/services/background-sync-service";
import { useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  getDefinedTaskCallback,
  mockExpoDbExecSync,
  mockGetLibraryChangesSince,
  mockIsTaskRegisteredAsync,
  mockRegisterTaskAsync,
  mockSyncProgress,
  mockUnregisterTaskAsync,
} from "@test/jest-setup";
import { emptyLibraryChanges } from "@test/sync-fixtures";

// Setup test database (needed for sync operations)
setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("background-sync-service", () => {
  beforeEach(() => {
    // Reset mocks
    mockIsTaskRegisteredAsync.mockReset();
    mockRegisterTaskAsync.mockReset();
    mockUnregisterTaskAsync.mockReset();
    mockExpoDbExecSync.mockReset();
    mockGetLibraryChangesSince.mockReset();
    mockSyncProgress.mockReset();

    // Default mock implementations using proper fixtures
    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(),
    });
    mockSyncProgress.mockResolvedValue({ success: true, result: {} });

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
      },
    });
  });

  // NOTE: Don't clear the task callback - it's set once when the module loads
  // and clearing it would break subsequent tests

  describe("registerBackgroundSyncTask", () => {
    it("registers the task when not already registered", async () => {
      mockIsTaskRegisteredAsync.mockResolvedValue(false);

      await registerBackgroundSyncTask();

      expect(mockIsTaskRegisteredAsync).toHaveBeenCalledWith(
        "ambry-background-sync",
      );
      expect(mockRegisterTaskAsync).toHaveBeenCalledWith(
        "ambry-background-sync",
        { minimumInterval: 15 },
      );
    });

    it("does not register when already registered", async () => {
      mockIsTaskRegisteredAsync.mockResolvedValue(true);

      await registerBackgroundSyncTask();

      expect(mockIsTaskRegisteredAsync).toHaveBeenCalledWith(
        "ambry-background-sync",
      );
      expect(mockRegisterTaskAsync).not.toHaveBeenCalled();
    });

    it("handles registration errors gracefully", async () => {
      mockIsTaskRegisteredAsync.mockRejectedValue(new Error("Test error"));

      // Should not throw
      await expect(registerBackgroundSyncTask()).resolves.not.toThrow();
    });
  });

  describe("unregisterBackgroundSyncTask", () => {
    it("unregisters the task", async () => {
      await unregisterBackgroundSyncTask();

      expect(mockUnregisterTaskAsync).toHaveBeenCalledWith(
        "ambry-background-sync",
      );
    });

    it("handles unregistration errors gracefully", async () => {
      mockUnregisterTaskAsync.mockRejectedValue(new Error("Test error"));

      // Should not throw
      await expect(unregisterBackgroundSyncTask()).resolves.not.toThrow();
    });
  });

  describe("background task execution", () => {
    it("defines a task callback", () => {
      const taskCallback = getDefinedTaskCallback();
      expect(taskCallback).not.toBeNull();
      expect(typeof taskCallback).toBe("function");
    });

    it("returns success when no session exists", async () => {
      useSession.setState({ session: null });

      const taskCallback = getDefinedTaskCallback();
      const result = await taskCallback!();

      expect(result).toBe("success");
      // Sync should not have been called
      expect(mockGetLibraryChangesSince).not.toHaveBeenCalled();
    });

    it("runs full sync cycle and returns success when session exists", async () => {
      useSession.setState({ session });

      const taskCallback = getDefinedTaskCallback();
      const result = await taskCallback!();

      // Should return success (not fail)
      expect(result).toBe("success");

      // Verify syncDownLibrary was called (syncs library changes from server)
      expect(mockGetLibraryChangesSince).toHaveBeenCalled();

      // Verify WAL checkpoint was executed (confirms we reached the success path)
      expect(mockExpoDbExecSync).toHaveBeenCalledWith(
        "PRAGMA wal_checkpoint(TRUNCATE);",
      );
    });

    it("returns failed when sync throws an error", async () => {
      useSession.setState({ session });
      mockGetLibraryChangesSince.mockRejectedValue(new Error("Sync error"));

      const taskCallback = getDefinedTaskCallback();
      const result = await taskCallback!();

      expect(result).toBe("failed");
    });
  });
});
