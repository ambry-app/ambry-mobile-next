import * as schema from "@/db/schema";
import {
  bumpPlaythroughDataVersion,
  initialDataVersionState,
  initializeDataVersion,
  setLibraryDataVersion,
  useDataVersion,
} from "@/stores/data-version";
import { setupTestDatabase } from "@test/db-test-utils";
import { createSyncedServer, DEFAULT_TEST_SESSION } from "@test/factories";
import { resetStoreBeforeEach } from "@test/store-test-utils";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("data-version store", () => {
  resetStoreBeforeEach(useDataVersion, initialDataVersionState);

  describe("initializeDataVersion", () => {
    it("sets initialized to true after initialization", async () => {
      await initializeDataVersion(session);

      expect(useDataVersion.getState().initialized).toBe(true);
    });

    it("returns needsInitialSync: true when no synced server exists", async () => {
      const result = await initializeDataVersion(session);

      expect(result.needsInitialSync).toBe(true);
    });

    it("returns needsInitialSync: true when lastSyncTime is null", async () => {
      const db = getDb();
      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: null,
        libraryDataVersion: null,
      });

      const result = await initializeDataVersion(session);

      expect(result.needsInitialSync).toBe(true);
    });

    it("returns needsInitialSync: false when lastSyncTime exists", async () => {
      const db = getDb();
      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: new Date(),
      });

      const result = await initializeDataVersion(session);

      expect(result.needsInitialSync).toBe(false);
    });

    it("sets libraryDataVersion from libraryDataVersion timestamp", async () => {
      const db = getDb();
      const timestamp = new Date("2024-06-15T12:00:00Z");
      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: timestamp,
      });

      await initializeDataVersion(session);

      expect(useDataVersion.getState().libraryDataVersion).toBe(
        timestamp.getTime(),
      );
    });

    it("sets libraryDataVersion to null when libraryDataVersion is null", async () => {
      const db = getDb();
      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: null,
      });

      await initializeDataVersion(session);

      expect(useDataVersion.getState().libraryDataVersion).toBeNull();
    });

    it("skips initialization if already initialized", async () => {
      const db = getDb();
      const firstTimestamp = new Date("2024-01-01T00:00:00Z");
      const secondTimestamp = new Date("2024-06-15T12:00:00Z");

      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: firstTimestamp,
      });

      // First initialization
      await initializeDataVersion(session);
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        firstTimestamp.getTime(),
      );

      // Update the database - but this shouldn't affect the store
      await db
        .update(schema.syncedServers)
        .set({ libraryDataVersion: secondTimestamp });

      // Second call should skip and return false
      const result = await initializeDataVersion(session);
      expect(result.needsInitialSync).toBe(false);
      // Should still have the first timestamp, not the updated one
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        firstTimestamp.getTime(),
      );
    });

    it("does not modify playthroughDataVersion during initialization", async () => {
      const db = getDb();
      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: new Date(),
      });

      await initializeDataVersion(session);

      expect(useDataVersion.getState().playthroughDataVersion).toBe(0);
    });

    it("uses correct server URL for multi-tenant lookup", async () => {
      const db = getDb();
      const otherSession = { ...session, url: "http://other-server.com" };
      const thisServerTimestamp = new Date("2024-01-01T00:00:00Z");
      const otherServerTimestamp = new Date("2024-06-15T12:00:00Z");

      await createSyncedServer(db, {
        url: session.url,
        lastSyncTime: new Date(),
        libraryDataVersion: thisServerTimestamp,
      });
      await createSyncedServer(db, {
        url: otherSession.url,
        lastSyncTime: new Date(),
        libraryDataVersion: otherServerTimestamp,
      });

      await initializeDataVersion(session);

      // Should use this server's timestamp, not the other one
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        thisServerTimestamp.getTime(),
      );
    });
  });

  describe("setLibraryDataVersion", () => {
    it("updates libraryDataVersion to timestamp", () => {
      const date = new Date("2024-07-20T15:30:00Z");

      setLibraryDataVersion(date);

      expect(useDataVersion.getState().libraryDataVersion).toBe(date.getTime());
    });

    it("can update libraryDataVersion multiple times", () => {
      const date1 = new Date("2024-07-20T15:30:00Z");
      const date2 = new Date("2024-07-21T10:00:00Z");

      setLibraryDataVersion(date1);
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        date1.getTime(),
      );

      setLibraryDataVersion(date2);
      expect(useDataVersion.getState().libraryDataVersion).toBe(
        date2.getTime(),
      );
    });
  });

  describe("bumpPlaythroughDataVersion", () => {
    it("increments playthroughDataVersion by 1", () => {
      expect(useDataVersion.getState().playthroughDataVersion).toBe(0);

      bumpPlaythroughDataVersion();

      expect(useDataVersion.getState().playthroughDataVersion).toBe(1);
    });

    it("can increment multiple times", () => {
      bumpPlaythroughDataVersion();
      bumpPlaythroughDataVersion();
      bumpPlaythroughDataVersion();

      expect(useDataVersion.getState().playthroughDataVersion).toBe(3);
    });

    it("does not affect other state", () => {
      useDataVersion.setState({ libraryDataVersion: 12345 });

      bumpPlaythroughDataVersion();

      expect(useDataVersion.getState().libraryDataVersion).toBe(12345);
    });
  });
});
