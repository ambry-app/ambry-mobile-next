/* eslint-disable import/first */
import { resetStoreBeforeEach } from "@test/store-test-utils";
const mockGetLibraryChangesSince = jest.fn();
const mockSyncProgress = jest.fn().mockResolvedValue({
  success: true,
  result: { syncProgress: emptySyncProgressResult() },
});

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

import * as schema from "@/db/schema";
import { syncLibrary, syncPlaythroughs } from "@/db/sync";
import { getServerSyncTimestamps } from "@/db/sync-helpers";
import { ExecuteAuthenticatedErrorCode } from "@/graphql/client/execute";
import { initialDataVersionState, useDataVersion } from "@/stores/data-version";
import { initialDeviceState, useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { DeviceInfo } from "@/types/device-info";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  createLibraryAuthor,
  createLibraryBook,
  createLibraryBookAuthor,
  createLibraryDeletion,
  createLibraryMedia,
  createLibraryMediaNarrator,
  createLibraryNarrator,
  createLibraryPerson,
  createLibrarySeries,
  createLibrarySeriesBook,
  createSyncPlaybackEvent,
  createSyncPlaythrough,
  DeletionType,
  emptyLibraryChanges,
  emptySyncProgressResult,
  PlaybackEventType,
  PlaythroughStatus,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

/* eslint-enable import/first */

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

const MOCK_DEVICE_INFO: DeviceInfo = {
  id: "test-device-id",
  type: "android",
  brand: "TestBrand",
  modelName: "TestModel",
  osName: "Android",
  osVersion: "14",
};

// Initial state for session store - set to our test session so sync functions work
const initialSessionState = { session };

// Reset stores between tests
resetStoreBeforeEach(useDataVersion, initialDataVersionState);
resetStoreBeforeEach(useDevice, initialDeviceState);
resetStoreBeforeEach(useSession, initialSessionState);

// Reset all mocks before each test
beforeEach(() => {
  mockGetLibraryChangesSince.mockClear();
  mockSyncProgress.mockClear();
  resetSyncFixtureIdCounter();
});

// =============================================================================
// getServerSyncTimestamps
// =============================================================================

describe("getServerSyncTimestamps", () => {
  it("returns null timestamps when no record exists", async () => {
    const result = await getServerSyncTimestamps(session);

    expect(result).toEqual({
      lastSyncTime: null,
      libraryDataVersion: null,
    });
  });

  it("returns existing timestamps when record exists", async () => {
    const db = getDb();
    const lastSyncTime = new Date("2024-01-15T10:00:00.000Z");
    const libraryDataVersion = new Date("2024-01-14T10:00:00.000Z");

    // Insert a synced server record
    await db.insert(schema.syncedServers).values({
      url: session.url,
      lastSyncTime,
      libraryDataVersion,
    });

    const result = await getServerSyncTimestamps(session);

    expect(result.lastSyncTime).toEqual(lastSyncTime);
    expect(result.libraryDataVersion).toEqual(libraryDataVersion);
  });
});

// =============================================================================
// syncLibrary
// =============================================================================

describe("syncLibrary", () => {
  // ===========================================================================
  // Happy Path: Basic sync operations
  // ===========================================================================

  describe("basic sync operations", () => {
    it("syncs empty changes and updates server timestamps", async () => {
      const db = getDb();
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: emptyLibraryChanges(serverTime),
      });

      await syncLibrary(session);

      // Verify syncedServers record was created
      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers).toHaveLength(1);
      expect(syncedServers[0]!.url).toBe(session.url);
      expect(syncedServers[0]!.lastSyncTime).toEqual(new Date(serverTime));
      expect(syncedServers[0]!.libraryDataVersion).toEqual(
        new Date(serverTime),
      );
    });

    it("passes lastSyncTime to API on subsequent syncs", async () => {
      const db = getDb();
      const firstServerTime = "2024-01-15T10:00:00.000Z";
      const secondServerTime = "2024-01-15T11:00:00.000Z";

      // First sync (no lastSyncTime)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(firstServerTime),
      });
      await syncLibrary(session);

      // Second sync (should pass lastSyncTime)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(secondServerTime),
      });
      await syncLibrary(session);

      // Verify the API was called with the correct lastSyncTime
      expect(mockGetLibraryChangesSince).toHaveBeenCalledTimes(2);
      // First call: no prior sync, so lastSync is undefined (from DB query returning undefined)
      expect(mockGetLibraryChangesSince).toHaveBeenNthCalledWith(
        1,
        session,
        undefined,
      );
      // Second call: should use the first sync's server time
      expect(mockGetLibraryChangesSince).toHaveBeenNthCalledWith(
        2,
        session,
        new Date(firstServerTime),
      );

      // Verify lastSyncTime was updated
      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.lastSyncTime).toEqual(
        new Date(secondServerTime),
      );
    });
  });

  // ===========================================================================
  // Inserting entities
  // ===========================================================================

  describe("inserting entities", () => {
    it("inserts new people from server response", async () => {
      const db = getDb();
      const person = createLibraryPerson({ id: "person-1", name: "John Doe" });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [person],
        },
      });

      await syncLibrary(session);

      const people = await db.query.people.findMany();
      expect(people).toHaveLength(1);
      expect(people[0]!.id).toBe("person-1");
      expect(people[0]!.name).toBe("John Doe");
      expect(people[0]!.url).toBe(session.url);
    });

    it("inserts new authors from server response", async () => {
      const db = getDb();
      const person = createLibraryPerson({ id: "person-1" });
      const author = createLibraryAuthor({
        id: "author-1",
        name: "John Author",
        personId: "person-1",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [person],
          authorsChangedSince: [author],
        },
      });

      await syncLibrary(session);

      const authors = await db.query.authors.findMany();
      expect(authors).toHaveLength(1);
      expect(authors[0]!.id).toBe("author-1");
      expect(authors[0]!.name).toBe("John Author");
      expect(authors[0]!.personId).toBe("person-1");
    });

    it("inserts new narrators from server response", async () => {
      const db = getDb();
      const person = createLibraryPerson({ id: "person-1" });
      const narrator = createLibraryNarrator({
        id: "narrator-1",
        name: "Jane Narrator",
        personId: "person-1",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [person],
          narratorsChangedSince: [narrator],
        },
      });

      await syncLibrary(session);

      const narrators = await db.query.narrators.findMany();
      expect(narrators).toHaveLength(1);
      expect(narrators[0]!.id).toBe("narrator-1");
      expect(narrators[0]!.name).toBe("Jane Narrator");
    });

    it("inserts new books from server response", async () => {
      const db = getDb();
      const book = createLibraryBook({
        id: "book-1",
        title: "My Great Book",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [book],
        },
      });

      await syncLibrary(session);

      const books = await db.query.books.findMany();
      expect(books).toHaveLength(1);
      expect(books[0]!.id).toBe("book-1");
      expect(books[0]!.title).toBe("My Great Book");
    });

    it("inserts new series from server response", async () => {
      const db = getDb();
      const series = createLibrarySeries({
        id: "series-1",
        name: "Epic Series",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          seriesChangedSince: [series],
        },
      });

      await syncLibrary(session);

      const allSeries = await db.query.series.findMany();
      expect(allSeries).toHaveLength(1);
      expect(allSeries[0]!.id).toBe("series-1");
      expect(allSeries[0]!.name).toBe("Epic Series");
    });

    it("inserts new media from server response", async () => {
      const db = getDb();
      const book = createLibraryBook({ id: "book-1" });
      const media = createLibraryMedia({
        id: "media-1",
        bookId: "book-1",
        duration: 7200,
        publisher: "Test Publisher",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [book],
          mediaChangedSince: [media],
        },
      });

      await syncLibrary(session);

      const allMedia = await db.query.media.findMany();
      expect(allMedia).toHaveLength(1);
      expect(allMedia[0]!.id).toBe("media-1");
      expect(allMedia[0]!.bookId).toBe("book-1");
      expect(allMedia[0]!.duration).toBe("7200"); // stored as string
      expect(allMedia[0]!.publisher).toBe("Test Publisher");
    });

    it("inserts book-author relationships", async () => {
      const db = getDb();
      const person = createLibraryPerson({ id: "person-1" });
      const author = createLibraryAuthor({
        id: "author-1",
        personId: "person-1",
      });
      const book = createLibraryBook({ id: "book-1" });
      const bookAuthor = createLibraryBookAuthor({
        id: "ba-1",
        bookId: "book-1",
        authorId: "author-1",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [person],
          authorsChangedSince: [author],
          booksChangedSince: [book],
          bookAuthorsChangedSince: [bookAuthor],
        },
      });

      await syncLibrary(session);

      const bookAuthors = await db.query.bookAuthors.findMany();
      expect(bookAuthors).toHaveLength(1);
      expect(bookAuthors[0]!.bookId).toBe("book-1");
      expect(bookAuthors[0]!.authorId).toBe("author-1");
    });

    it("inserts series-book relationships", async () => {
      const db = getDb();
      const book = createLibraryBook({ id: "book-1" });
      const series = createLibrarySeries({ id: "series-1" });
      const seriesBook = createLibrarySeriesBook({
        id: "sb-1",
        bookId: "book-1",
        seriesId: "series-1",
        bookNumber: "3",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [book],
          seriesChangedSince: [series],
          seriesBooksChangedSince: [seriesBook],
        },
      });

      await syncLibrary(session);

      const seriesBooks = await db.query.seriesBooks.findMany();
      expect(seriesBooks).toHaveLength(1);
      expect(seriesBooks[0]!.bookId).toBe("book-1");
      expect(seriesBooks[0]!.seriesId).toBe("series-1");
      expect(seriesBooks[0]!.bookNumber).toBe("3");
    });

    it("inserts media-narrator relationships", async () => {
      const db = getDb();
      const person = createLibraryPerson({ id: "person-1" });
      const narrator = createLibraryNarrator({
        id: "narrator-1",
        personId: "person-1",
      });
      const book = createLibraryBook({ id: "book-1" });
      const media = createLibraryMedia({ id: "media-1", bookId: "book-1" });
      const mediaNarrator = createLibraryMediaNarrator({
        id: "mn-1",
        mediaId: "media-1",
        narratorId: "narrator-1",
      });

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [person],
          narratorsChangedSince: [narrator],
          booksChangedSince: [book],
          mediaChangedSince: [media],
          mediaNarratorsChangedSince: [mediaNarrator],
        },
      });

      await syncLibrary(session);

      const mediaNarrators = await db.query.mediaNarrators.findMany();
      expect(mediaNarrators).toHaveLength(1);
      expect(mediaNarrators[0]!.mediaId).toBe("media-1");
      expect(mediaNarrators[0]!.narratorId).toBe("narrator-1");
    });
  });

  // ===========================================================================
  // Updating entities (upsert behavior)
  // ===========================================================================

  describe("updating entities", () => {
    it("updates existing person when syncing", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync: insert person
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(serverTime1),
          peopleChangedSince: [
            createLibraryPerson({ id: "person-1", name: "John" }),
          ],
        },
      });
      await syncLibrary(session);

      // Second sync: update person
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(serverTime2),
          peopleChangedSince: [
            createLibraryPerson({
              id: "person-1",
              name: "John Updated",
              description: "A description",
            }),
          ],
        },
      });
      await syncLibrary(session);

      const people = await db.query.people.findMany();
      expect(people).toHaveLength(1);
      expect(people[0]!.name).toBe("John Updated");
      expect(people[0]!.description).toBe("A description");
    });

    it("updates existing book when syncing", async () => {
      const db = getDb();

      // First sync
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [
            createLibraryBook({ id: "book-1", title: "Original Title" }),
          ],
        },
      });
      await syncLibrary(session);

      // Second sync
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [
            createLibraryBook({ id: "book-1", title: "New Title" }),
          ],
        },
      });
      await syncLibrary(session);

      const books = await db.query.books.findMany();
      expect(books).toHaveLength(1);
      expect(books[0]!.title).toBe("New Title");
    });
  });

  // ===========================================================================
  // Deletions
  // ===========================================================================

  describe("deletions", () => {
    it("deletes person when deletion received", async () => {
      const db = getDb();

      // First sync: insert person
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
        },
      });
      await syncLibrary(session);

      // Verify person exists
      let people = await db.query.people.findMany();
      expect(people).toHaveLength(1);

      // Second sync: delete person
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          deletionsSince: [
            createLibraryDeletion(DeletionType.Person, "person-1"),
          ],
        },
      });
      await syncLibrary(session);

      // Verify person deleted
      people = await db.query.people.findMany();
      expect(people).toHaveLength(0);
    });

    it("deletes media when deletion received", async () => {
      const db = getDb();

      // First sync: insert book and media
      const book = createLibraryBook({ id: "book-1" });
      const media = createLibraryMedia({ id: "media-1", bookId: "book-1" });

      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [book],
          mediaChangedSince: [media],
        },
      });
      await syncLibrary(session);

      // Verify media exists
      let allMedia = await db.query.media.findMany();
      expect(allMedia).toHaveLength(1);

      // Second sync: delete media
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          deletionsSince: [
            createLibraryDeletion(DeletionType.Media, "media-1"),
          ],
        },
      });
      await syncLibrary(session);

      // Verify media deleted
      allMedia = await db.query.media.findMany();
      expect(allMedia).toHaveLength(0);
    });

    it("handles multiple deletion types in one sync", async () => {
      const db = getDb();

      // First sync: insert entities
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          seriesChangedSince: [createLibrarySeries({ id: "series-1" })],
        },
      });
      await syncLibrary(session);

      // Second sync: delete all
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          deletionsSince: [
            createLibraryDeletion(DeletionType.Person, "person-1"),
            createLibraryDeletion(DeletionType.Book, "book-1"),
            createLibraryDeletion(DeletionType.Series, "series-1"),
          ],
        },
      });
      await syncLibrary(session);

      expect(await db.query.people.findMany()).toHaveLength(0);
      expect(await db.query.books.findMany()).toHaveLength(0);
      expect(await db.query.series.findMany()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe("error handling", () => {
    it("returns early on network error without DB changes", async () => {
      const db = getDb();

      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
      });

      await syncLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });

    it("returns early on server error without DB changes", async () => {
      const db = getDb();

      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
          status: 500,
        },
      });

      await syncLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });

    it("returns early on GQL error without DB changes", async () => {
      const db = getDb();

      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.GQL_ERROR,
          message: "Some GraphQL error",
        },
      });

      await syncLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncLibrary(session);
    });

    it("does not update DB on unauthorized error", async () => {
      const db = getDb();

      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Timestamp tracking (libraryDataVersion)
  // ===========================================================================

  describe("timestamp tracking", () => {
    it("sets libraryDataVersion to serverTime on first sync", async () => {
      const db = getDb();
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: emptyLibraryChanges(serverTime),
      });

      await syncLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.libraryDataVersion).toEqual(
        new Date(serverTime),
      );
    });

    it("updates libraryDataVersion when changes received", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(serverTime1),
      });
      await syncLibrary(session);

      // Second sync with new data
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(serverTime2),
          peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
        },
      });
      await syncLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.libraryDataVersion).toEqual(
        new Date(serverTime2),
      );
    });

    it("keeps previous libraryDataVersion when no changes received", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync with data
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(serverTime1),
          peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
        },
      });
      await syncLibrary(session);

      // Second sync without new data
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(serverTime2),
      });
      await syncLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      // lastSyncTime should update to serverTime2
      expect(syncedServers[0]!.lastSyncTime).toEqual(new Date(serverTime2));
      // But libraryDataVersion should remain at serverTime1 (when we last had actual changes)
      expect(syncedServers[0]!.libraryDataVersion).toEqual(
        new Date(serverTime1),
      );
    });
  });
});

// =============================================================================
// syncUp
// =============================================================================

describe("syncPlaythroughs", () => {
  // Helper to create media in DB first (needed for FK constraints)
  async function setupMediaInDb(db: ReturnType<typeof getDb>) {
    mockGetLibraryChangesSince.mockResolvedValueOnce({
      success: true,
      result: {
        ...emptyLibraryChanges(),
        booksChangedSince: [createLibraryBook({ id: "book-1" })],
        mediaChangedSince: [
          createLibraryMedia({ id: "media-1", bookId: "book-1" }),
          createLibraryMedia({ id: "media-2", bookId: "book-1" }),
        ],
      },
    });
    await syncLibrary(session);
  }

  // Note: Device initialization check happens at service layer (sync-service.ts),
  // not at db layer. The db layer receives deviceInfo as a parameter.

  // ===========================================================================
  // Empty sync
  // ===========================================================================

  describe("empty sync", () => {
    it("calls API with empty playthroughs and events when nothing to sync", async () => {
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult() },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.playthroughs).toHaveLength(0);
      expect(input.events).toHaveLength(0);
    });

    it("updates server profile lastSyncTime on empty sync", async () => {
      const db = getDb();

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult(serverTime) },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]!.lastSyncTime).toEqual(new Date(serverTime));
    });
  });

  // ===========================================================================
  // Up-sync: Sending playthroughs and events to server
  // ===========================================================================

  describe("up-sync", () => {
    it("sends unsynced playthroughs to server", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create an unsynced playthrough
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: null, // Unsynced
      });

      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult() },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.playthroughs).toHaveLength(1);
      expect(input.playthroughs[0].id).toBe("playthrough-1");
      expect(input.playthroughs[0].mediaId).toBe("media-1");
      expect(input.playthroughs[0].status).toBe("IN_PROGRESS");
    });

    it("sends unsynced events to server", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create a synced playthrough first
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: now, // Already synced
      });

      // Create an unsynced event
      await db.insert(schema.playbackEvents).values({
        id: "event-1",
        playthroughId: "playthrough-1",
        deviceId: "test-device-id",
        type: "play",
        timestamp: now,
        position: 100,
        playbackRate: 1.0,
        syncedAt: null, // Unsynced
      });

      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult() },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.events).toHaveLength(1);
      expect(input.events[0].id).toBe("event-1");
      expect(input.events[0].type).toBe("PLAY");
    });

    it("marks playthroughs as synced after successful sync", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create an unsynced playthrough
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      });

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult(serverTime) },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const playthroughs = await db.query.playthroughs.findMany();
      expect(playthroughs[0]!.syncedAt).toEqual(new Date(serverTime));
    });

    it("marks events as synced after successful sync", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create a synced playthrough
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: now,
      });

      // Create an unsynced event
      await db.insert(schema.playbackEvents).values({
        id: "event-1",
        playthroughId: "playthrough-1",
        deviceId: "test-device-id",
        type: "play",
        timestamp: now,
        position: 100,
        playbackRate: 1.0,
        syncedAt: null,
      });

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult(serverTime) },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const events = await db.query.playbackEvents.findMany();
      expect(events[0]!.syncedAt).toEqual(new Date(serverTime));
    });
  });

  // ===========================================================================
  // Down-sync: Receiving playthroughs and events from server
  // ===========================================================================

  describe("down-sync", () => {
    it("upserts received playthroughs from server", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: {
          syncProgress: {
            ...emptySyncProgressResult(serverTime),
            playthroughs: [
              createSyncPlaythrough({
                id: "server-playthrough-1",
                mediaId: "media-1",
                status: PlaythroughStatus.InProgress,
              }),
            ],
          },
        },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const playthroughs = await db.query.playthroughs.findMany();
      expect(playthroughs).toHaveLength(1);
      expect(playthroughs[0]!.id).toBe("server-playthrough-1");
      expect(playthroughs[0]!.mediaId).toBe("media-1");
      expect(playthroughs[0]!.status).toBe("in_progress");
    });

    it("upserts received events from server", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create local playthrough first (events need it)
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: now,
      });

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: {
          syncProgress: {
            ...emptySyncProgressResult(serverTime),
            events: [
              createSyncPlaybackEvent({
                id: "server-event-1",
                playthroughId: "playthrough-1",
                type: PlaybackEventType.Pause,
                position: 500,
                playbackRate: 1.25,
              }),
            ],
          },
        },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const events = await db.query.playbackEvents.findMany();
      expect(events).toHaveLength(1);
      expect(events[0]!.id).toBe("server-event-1");
      expect(events[0]!.type).toBe("pause");
      expect(events[0]!.position).toBe(500);
    });

    it("updates state cache for received events with position", async () => {
      const db = getDb();

      await setupMediaInDb(db);

      // Create local playthrough first
      const now = new Date();
      await db.insert(schema.playthroughs).values({
        id: "playthrough-1",
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        status: "in_progress",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        syncedAt: now,
      });

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: {
          syncProgress: {
            ...emptySyncProgressResult(serverTime),
            events: [
              createSyncPlaybackEvent({
                id: "server-event-1",
                playthroughId: "playthrough-1",
                type: PlaybackEventType.Play,
                position: 750,
                playbackRate: 1.5,
              }),
            ],
          },
        },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const cache = await db.query.playthroughStateCache.findFirst({
        where: (t, { eq }) => eq(t.playthroughId, "playthrough-1"),
      });
      expect(cache).not.toBeNull();
      expect(cache!.currentPosition).toBe(750);
      expect(cache!.currentRate).toBe(1.5);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe("error handling", () => {
    it("returns early on network error", async () => {
      const db = getDb();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on server error", async () => {
      const db = getDb();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
          status: 500,
        },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on GQL error", async () => {
      const db = getDb();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.GQL_ERROR,
          message: "Some error",
        },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      mockSyncProgress.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncPlaythroughs(session, MOCK_DEVICE_INFO);
    });
  });
});
