import * as schema from "@/db/schema";
import {
  getServerSyncTimestamps,
  syncDown,
  syncDownLibrary,
  syncDownUser,
  syncPlaythroughs,
  syncUp,
} from "@/db/sync";
import { ExecuteAuthenticatedErrorCode } from "@/graphql/client/execute";
import { initialDataVersionState, useDataVersion } from "@/stores/data-version";
import { initialDeviceState, useDevice } from "@/stores/device";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import {
  mockForceSignOut,
  mockGetLibraryChangesSince,
  mockGetUserChangesSince,
  mockSyncProgress,
  mockUpdatePlayerState,
} from "@test/jest-setup";
import { resetStoreBeforeEach } from "@test/store-test-utils";
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
  createUserPlayerState,
  DeletionType,
  emptyLibraryChanges,
  emptySyncProgressResult,
  emptyUserChanges,
  PlaybackEventType,
  PlayerStateStatus,
  PlaythroughStatus,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

// Reset stores between tests
resetStoreBeforeEach(useDataVersion, initialDataVersionState);
resetStoreBeforeEach(useDevice, initialDeviceState);

// Reset all mocks before each test
beforeEach(() => {
  mockGetLibraryChangesSince.mockReset();
  mockGetUserChangesSince.mockReset();
  mockUpdatePlayerState.mockReset();
  mockSyncProgress.mockReset();
  mockForceSignOut.mockReset();
  resetSyncFixtureIdCounter();
});

// =============================================================================
// getServerSyncTimestamps
// =============================================================================

describe("getServerSyncTimestamps", () => {
  it("returns null timestamps when no record exists", async () => {
    const result = await getServerSyncTimestamps(session);

    expect(result).toEqual({
      lastDownSync: null,
      newDataAsOf: null,
    });
  });

  it("returns existing timestamps when record exists", async () => {
    const db = getDb();
    const lastDownSync = new Date("2024-01-15T10:00:00.000Z");
    const newDataAsOf = new Date("2024-01-14T10:00:00.000Z");

    // Insert a synced server record
    await db.insert(schema.syncedServers).values({
      url: session.url,
      lastDownSync,
      newDataAsOf,
    });

    const result = await getServerSyncTimestamps(session);

    expect(result.lastDownSync).toEqual(lastDownSync);
    expect(result.newDataAsOf).toEqual(newDataAsOf);
  });
});

// =============================================================================
// syncDown
// =============================================================================

describe("syncDown", () => {
  it("calls both syncDownLibrary and syncDownUser", async () => {
    const serverTime = "2024-01-15T10:00:00.000Z";

    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(serverTime),
    });
    mockGetUserChangesSince.mockResolvedValue({
      success: true,
      result: emptyUserChanges(serverTime),
    });

    await syncDown(session);

    expect(mockGetLibraryChangesSince).toHaveBeenCalledTimes(1);
    expect(mockGetUserChangesSince).toHaveBeenCalledTimes(1);
  });

  it("completes successfully when both syncs succeed", async () => {
    const db = getDb();
    const serverTime = "2024-01-15T10:00:00.000Z";

    mockGetLibraryChangesSince.mockResolvedValue({
      success: true,
      result: emptyLibraryChanges(serverTime),
    });
    mockGetUserChangesSince.mockResolvedValue({
      success: true,
      result: emptyUserChanges(serverTime),
    });

    await syncDown(session);

    // Both syncedServers and serverProfiles should be updated
    const syncedServers = await db.query.syncedServers.findMany();
    const serverProfiles = await db.query.serverProfiles.findMany();

    expect(syncedServers).toHaveLength(1);
    expect(serverProfiles).toHaveLength(1);
  });
});

// =============================================================================
// syncDownLibrary
// =============================================================================

describe("syncDownLibrary", () => {
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

      await syncDownLibrary(session);

      // Verify syncedServers record was created
      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers).toHaveLength(1);
      expect(syncedServers[0]!.url).toBe(session.url);
      expect(syncedServers[0]!.lastDownSync).toEqual(new Date(serverTime));
      expect(syncedServers[0]!.newDataAsOf).toEqual(new Date(serverTime));
    });

    it("updates libraryDataVersion store after sync", async () => {
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: emptyLibraryChanges(serverTime),
      });

      await syncDownLibrary(session);

      const { libraryDataVersion } = useDataVersion.getState();
      expect(libraryDataVersion).toBe(new Date(serverTime).getTime());
    });

    it("passes lastDownSync to API on subsequent syncs", async () => {
      const db = getDb();
      const firstServerTime = "2024-01-15T10:00:00.000Z";
      const secondServerTime = "2024-01-15T11:00:00.000Z";

      // First sync (no lastDownSync)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(firstServerTime),
      });
      await syncDownLibrary(session);

      // Second sync (should pass lastDownSync)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(secondServerTime),
      });
      await syncDownLibrary(session);

      // Verify the API was called with the correct lastDownSync
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

      // Verify lastDownSync was updated
      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.lastDownSync).toEqual(
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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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
      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

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

      await syncDownLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncDownLibrary(session);

      expect(mockForceSignOut).toHaveBeenCalled();
    });

    it("does not update DB on unauthorized error", async () => {
      const db = getDb();

      mockGetLibraryChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncDownLibrary(session);

      const servers = await db.query.syncedServers.findMany();
      expect(servers).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Timestamp tracking (newDataAsOf)
  // ===========================================================================

  describe("timestamp tracking", () => {
    it("sets newDataAsOf to serverTime on first sync", async () => {
      const db = getDb();
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetLibraryChangesSince.mockResolvedValue({
        success: true,
        result: emptyLibraryChanges(serverTime),
      });

      await syncDownLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.newDataAsOf).toEqual(new Date(serverTime));
    });

    it("updates newDataAsOf when changes received", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(serverTime1),
      });
      await syncDownLibrary(session);

      // Second sync with new data
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(serverTime2),
          peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
        },
      });
      await syncDownLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      expect(syncedServers[0]!.newDataAsOf).toEqual(new Date(serverTime2));
    });

    it("keeps previous newDataAsOf when no changes received", async () => {
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
      await syncDownLibrary(session);

      // Second sync without new data
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyLibraryChanges(serverTime2),
      });
      await syncDownLibrary(session);

      const syncedServers = await db.query.syncedServers.findMany();
      // lastDownSync should update to serverTime2
      expect(syncedServers[0]!.lastDownSync).toEqual(new Date(serverTime2));
      // But newDataAsOf should remain at serverTime1 (when we last had actual changes)
      expect(syncedServers[0]!.newDataAsOf).toEqual(new Date(serverTime1));
    });
  });
});

// =============================================================================
// syncDownUser
// =============================================================================

describe("syncDownUser", () => {
  // ===========================================================================
  // Happy Path: Basic sync operations
  // ===========================================================================

  describe("basic sync operations", () => {
    it("syncs empty changes and updates server profile timestamps", async () => {
      const db = getDb();
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetUserChangesSince.mockResolvedValue({
        success: true,
        result: emptyUserChanges(serverTime),
      });

      await syncDownUser(session);

      // Verify serverProfiles record was created
      const serverProfiles = await db.query.serverProfiles.findMany();
      expect(serverProfiles).toHaveLength(1);
      expect(serverProfiles[0]!.url).toBe(session.url);
      expect(serverProfiles[0]!.userEmail).toBe(session.email);
      expect(serverProfiles[0]!.lastDownSync).toEqual(new Date(serverTime));
      expect(serverProfiles[0]!.newDataAsOf).toEqual(new Date(serverTime));
    });

    it("passes lastDownSync to API on subsequent syncs", async () => {
      const firstServerTime = "2024-01-15T10:00:00.000Z";
      const secondServerTime = "2024-01-15T11:00:00.000Z";

      // First sync (no lastDownSync)
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyUserChanges(firstServerTime),
      });
      await syncDownUser(session);

      // Second sync (should pass lastDownSync)
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyUserChanges(secondServerTime),
      });
      await syncDownUser(session);

      // Verify the API was called with the correct lastDownSync
      expect(mockGetUserChangesSince).toHaveBeenCalledTimes(2);
      expect(mockGetUserChangesSince).toHaveBeenNthCalledWith(
        1,
        session,
        undefined,
      );
      expect(mockGetUserChangesSince).toHaveBeenNthCalledWith(
        2,
        session,
        new Date(firstServerTime),
      );
    });
  });

  // ===========================================================================
  // Inserting player states
  // ===========================================================================

  describe("inserting player states", () => {
    it("inserts new player states from server response", async () => {
      const db = getDb();

      // First sync library to create media (player states have FK to media)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
          ],
        },
      });
      await syncDownLibrary(session);

      const playerState = createUserPlayerState({
        id: "ps-1",
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.5,
      });

      mockGetUserChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyUserChanges(),
          playerStatesChangedSince: [playerState],
        },
      });

      await syncDownUser(session);

      const playerStates = await db.query.playerStates.findMany();
      expect(playerStates).toHaveLength(1);
      expect(playerStates[0]!.id).toBe("ps-1");
      expect(playerStates[0]!.mediaId).toBe("media-1");
      expect(playerStates[0]!.position).toBe(1500);
      expect(playerStates[0]!.playbackRate).toBe(1.5);
      expect(playerStates[0]!.url).toBe(session.url);
      expect(playerStates[0]!.userEmail).toBe(session.email);
    });

    it("handles different player state statuses", async () => {
      const db = getDb();

      // First sync library to create media (player states have FK to media)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
            createLibraryMedia({ id: "media-2", bookId: "book-1" }),
            createLibraryMedia({ id: "media-3", bookId: "book-1" }),
          ],
        },
      });
      await syncDownLibrary(session);

      mockGetUserChangesSince.mockResolvedValue({
        success: true,
        result: {
          ...emptyUserChanges(),
          playerStatesChangedSince: [
            createUserPlayerState({
              id: "ps-1",
              mediaId: "media-1",
              status: PlayerStateStatus.NotStarted,
            }),
            createUserPlayerState({
              id: "ps-2",
              mediaId: "media-2",
              status: PlayerStateStatus.InProgress,
            }),
            createUserPlayerState({
              id: "ps-3",
              mediaId: "media-3",
              status: PlayerStateStatus.Finished,
            }),
          ],
        },
      });

      await syncDownUser(session);

      const playerStates = await db.query.playerStates.findMany();
      expect(playerStates).toHaveLength(3);

      const statuses = playerStates.map((ps) => ps.status).sort();
      expect(statuses).toEqual(["finished", "in_progress", "not_started"]);
    });
  });

  // ===========================================================================
  // Updating player states (upsert behavior)
  // ===========================================================================

  describe("updating player states", () => {
    it("updates existing player state when syncing", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync library to create media (player states have FK to media)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
          ],
        },
      });
      await syncDownLibrary(session);

      // First user sync: insert player state
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyUserChanges(serverTime1),
          playerStatesChangedSince: [
            createUserPlayerState({
              id: "ps-1",
              mediaId: "media-1",
              position: 100,
              playbackRate: 1.0,
            }),
          ],
        },
      });
      await syncDownUser(session);

      // Second user sync: update player state
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyUserChanges(serverTime2),
          playerStatesChangedSince: [
            createUserPlayerState({
              id: "ps-1",
              mediaId: "media-1",
              position: 500,
              playbackRate: 1.5,
              status: PlayerStateStatus.InProgress,
            }),
          ],
        },
      });
      await syncDownUser(session);

      const playerStates = await db.query.playerStates.findMany();
      expect(playerStates).toHaveLength(1);
      expect(playerStates[0]!.position).toBe(500);
      expect(playerStates[0]!.playbackRate).toBe(1.5);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe("error handling", () => {
    it("returns early on network error without DB changes", async () => {
      const db = getDb();

      mockGetUserChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
      });

      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on server error without DB changes", async () => {
      const db = getDb();

      mockGetUserChangesSince.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
          status: 500,
        },
      });

      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on GQL error without DB changes", async () => {
      const db = getDb();

      mockGetUserChangesSince.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.GQL_ERROR,
          message: "Some GraphQL error",
        },
      });

      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      mockGetUserChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncDownUser(session);

      expect(mockForceSignOut).toHaveBeenCalled();
    });

    it("does not update DB on unauthorized error", async () => {
      const db = getDb();

      mockGetUserChangesSince.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Timestamp tracking (newDataAsOf)
  // ===========================================================================

  describe("timestamp tracking", () => {
    it("sets newDataAsOf to serverTime on first sync", async () => {
      const db = getDb();
      const serverTime = "2024-01-15T10:00:00.000Z";

      mockGetUserChangesSince.mockResolvedValue({
        success: true,
        result: emptyUserChanges(serverTime),
      });

      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles[0]!.newDataAsOf).toEqual(new Date(serverTime));
    });

    it("updates newDataAsOf when changes received", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync library to create media (player states have FK to media)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
          ],
        },
      });
      await syncDownLibrary(session);

      // First user sync
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyUserChanges(serverTime1),
      });
      await syncDownUser(session);

      // Second sync with new data
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyUserChanges(serverTime2),
          playerStatesChangedSince: [
            createUserPlayerState({ id: "ps-1", mediaId: "media-1" }),
          ],
        },
      });
      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles[0]!.newDataAsOf).toEqual(new Date(serverTime2));
    });

    it("keeps previous newDataAsOf when no changes received", async () => {
      const db = getDb();
      const serverTime1 = "2024-01-15T10:00:00.000Z";
      const serverTime2 = "2024-01-15T11:00:00.000Z";

      // First sync library to create media (player states have FK to media)
      mockGetLibraryChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
          ],
        },
      });
      await syncDownLibrary(session);

      // First user sync with data
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: {
          ...emptyUserChanges(serverTime1),
          playerStatesChangedSince: [
            createUserPlayerState({ id: "ps-1", mediaId: "media-1" }),
          ],
        },
      });
      await syncDownUser(session);

      // Second sync without new data
      mockGetUserChangesSince.mockResolvedValueOnce({
        success: true,
        result: emptyUserChanges(serverTime2),
      });
      await syncDownUser(session);

      const profiles = await db.query.serverProfiles.findMany();
      // lastDownSync should update to serverTime2
      expect(profiles[0]!.lastDownSync).toEqual(new Date(serverTime2));
      // But newDataAsOf should remain at serverTime1
      expect(profiles[0]!.newDataAsOf).toEqual(new Date(serverTime1));
    });
  });
});

// =============================================================================
// syncUp
// =============================================================================

describe("syncUp", () => {
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
    await syncDownLibrary(session);
  }

  // ===========================================================================
  // Happy Path: Basic sync operations
  // ===========================================================================

  describe("basic sync operations", () => {
    it("does nothing when no local player states changed", async () => {
      await syncUp(session);

      // No mutations should have been called
      expect(mockUpdatePlayerState).not.toHaveBeenCalled();
    });

    it("syncs a single changed local player state", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      // Insert a local player state
      const now = new Date();
      await db.insert(schema.localPlayerStates).values({
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.25,
        status: "in_progress",
        insertedAt: now,
        updatedAt: now,
      });

      mockUpdatePlayerState.mockResolvedValue({
        success: true,
        result: { updatePlayerState: { playerState: { updatedAt: now } } },
      });

      await syncUp(session);

      expect(mockUpdatePlayerState).toHaveBeenCalledTimes(1);
      expect(mockUpdatePlayerState).toHaveBeenCalledWith(
        session,
        "media-1",
        1500,
        1.25,
      );
    });

    it("syncs multiple changed local player states", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values([
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-1",
          position: 1000,
          playbackRate: 1.0,
          status: "in_progress",
          insertedAt: now,
          updatedAt: now,
        },
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-2",
          position: 2000,
          playbackRate: 1.5,
          status: "in_progress",
          insertedAt: now,
          updatedAt: now,
        },
      ]);

      mockUpdatePlayerState.mockResolvedValue({
        success: true,
        result: { updatePlayerState: { playerState: { updatedAt: now } } },
      });

      await syncUp(session);

      expect(mockUpdatePlayerState).toHaveBeenCalledTimes(2);
    });

    it("only syncs changes since last sync", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const oldTime = new Date("2024-01-15T09:00:00.000Z");
      const syncTime = new Date("2024-01-15T10:00:00.000Z");
      const newTime = new Date("2024-01-15T11:00:00.000Z");

      // Create initial server profile with lastUpSync
      await db.insert(schema.serverProfiles).values({
        url: session.url,
        userEmail: session.email,
        lastUpSync: syncTime,
      });

      // Insert one old player state (before lastUpSync) and one new
      await db.insert(schema.localPlayerStates).values([
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-1",
          position: 1000,
          playbackRate: 1.0,
          status: "in_progress",
          insertedAt: oldTime,
          updatedAt: oldTime, // Before lastUpSync
        },
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-2",
          position: 2000,
          playbackRate: 1.5,
          status: "in_progress",
          insertedAt: newTime,
          updatedAt: newTime, // After lastUpSync
        },
      ]);

      mockUpdatePlayerState.mockResolvedValue({
        success: true,
        result: {
          updatePlayerState: { playerState: { updatedAt: newTime } },
        },
      });

      await syncUp(session);

      // Only the new one should be synced
      expect(mockUpdatePlayerState).toHaveBeenCalledTimes(1);
      expect(mockUpdatePlayerState).toHaveBeenCalledWith(
        session,
        "media-2",
        2000,
        1.5,
      );
    });
  });

  // ===========================================================================
  // Timestamp tracking
  // ===========================================================================

  describe("timestamp tracking", () => {
    it("updates lastUpSync after successful sync", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values({
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.0,
        status: "in_progress",
        insertedAt: now,
        updatedAt: now,
      });

      mockUpdatePlayerState.mockResolvedValue({
        success: true,
        result: { updatePlayerState: { playerState: { updatedAt: now } } },
      });

      await syncUp(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]!.lastUpSync).not.toBeNull();
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe("error handling", () => {
    it("stops syncing on network error", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values([
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-1",
          position: 1000,
          playbackRate: 1.0,
          status: "in_progress",
          insertedAt: now,
          updatedAt: now,
        },
        {
          url: session.url,
          userEmail: session.email,
          mediaId: "media-2",
          position: 2000,
          playbackRate: 1.5,
          status: "in_progress",
          insertedAt: now,
          updatedAt: now,
        },
      ]);

      // First call succeeds, second fails
      mockUpdatePlayerState
        .mockResolvedValueOnce({
          success: true,
          result: { updatePlayerState: { playerState: { updatedAt: now } } },
        })
        .mockResolvedValueOnce({
          success: false,
          error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
        });

      await syncUp(session);

      // Should have tried both but stopped after error
      expect(mockUpdatePlayerState).toHaveBeenCalledTimes(2);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values({
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.0,
        status: "in_progress",
        insertedAt: now,
        updatedAt: now,
      });

      mockUpdatePlayerState.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncUp(session);

      expect(mockForceSignOut).toHaveBeenCalled();
    });

    it("does not update lastUpSync on error", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values({
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.0,
        status: "in_progress",
        insertedAt: now,
        updatedAt: now,
      });

      mockUpdatePlayerState.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
      });

      await syncUp(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("stops syncing on server error", async () => {
      const db = getDb();
      await setupMediaInDb(db);

      const now = new Date();
      await db.insert(schema.localPlayerStates).values({
        url: session.url,
        userEmail: session.email,
        mediaId: "media-1",
        position: 1500,
        playbackRate: 1.0,
        status: "in_progress",
        insertedAt: now,
        updatedAt: now,
      });

      mockUpdatePlayerState.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
          status: 500,
        },
      });

      await syncUp(session);

      // Should not update lastUpSync on error
      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });
  });
});

// =============================================================================
// syncPlaythroughs
// =============================================================================

describe("syncPlaythroughs", () => {
  // Helper to initialize device store
  function initializeDeviceStore() {
    useDevice.setState({
      initialized: true,
      deviceInfo: {
        id: "test-device-id",
        type: "android",
        brand: "TestBrand",
        modelName: "TestModel",
        osName: "TestOS",
        osVersion: "1.0.0",
      },
    });
  }

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
    await syncDownLibrary(session);
  }

  // ===========================================================================
  // Device check
  // ===========================================================================

  describe("device check", () => {
    it("returns early if device not initialized", async () => {
      // Device store is already reset to uninitialized state

      await syncPlaythroughs(session);

      // No API call should be made
      expect(mockSyncProgress).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Empty sync
  // ===========================================================================

  describe("empty sync", () => {
    it("calls API with empty playthroughs and events when nothing to sync", async () => {
      initializeDeviceStore();

      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult() },
      });

      await syncPlaythroughs(session);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.playthroughs).toHaveLength(0);
      expect(input.events).toHaveLength(0);
    });

    it("updates server profile lastDownSync on empty sync", async () => {
      const db = getDb();
      initializeDeviceStore();

      const serverTime = "2024-01-15T10:00:00.000Z";
      mockSyncProgress.mockResolvedValue({
        success: true,
        result: { syncProgress: emptySyncProgressResult(serverTime) },
      });

      await syncPlaythroughs(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]!.lastDownSync).toEqual(new Date(serverTime));
    });
  });

  // ===========================================================================
  // Up-sync: Sending playthroughs and events to server
  // ===========================================================================

  describe("up-sync", () => {
    it("sends unsynced playthroughs to server", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.playthroughs).toHaveLength(1);
      expect(input.playthroughs[0].id).toBe("playthrough-1");
      expect(input.playthroughs[0].mediaId).toBe("media-1");
      expect(input.playthroughs[0].status).toBe("IN_PROGRESS");
    });

    it("sends unsynced events to server", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

      expect(mockSyncProgress).toHaveBeenCalledTimes(1);
      const input = mockSyncProgress.mock.calls[0][1];
      expect(input.events).toHaveLength(1);
      expect(input.events[0].id).toBe("event-1");
      expect(input.events[0].type).toBe("PLAY");
    });

    it("marks playthroughs as synced after successful sync", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

      const playthroughs = await db.query.playthroughs.findMany();
      expect(playthroughs[0]!.syncedAt).toEqual(new Date(serverTime));
    });

    it("marks events as synced after successful sync", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

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
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

      const playthroughs = await db.query.playthroughs.findMany();
      expect(playthroughs).toHaveLength(1);
      expect(playthroughs[0]!.id).toBe("server-playthrough-1");
      expect(playthroughs[0]!.mediaId).toBe("media-1");
      expect(playthroughs[0]!.status).toBe("in_progress");
    });

    it("upserts received events from server", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

      const events = await db.query.playbackEvents.findMany();
      expect(events).toHaveLength(1);
      expect(events[0]!.id).toBe("server-event-1");
      expect(events[0]!.type).toBe("pause");
      expect(events[0]!.position).toBe(500);
    });

    it("updates state cache for received events with position", async () => {
      const db = getDb();
      initializeDeviceStore();
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

      await syncPlaythroughs(session);

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
      initializeDeviceStore();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.NETWORK_ERROR },
      });

      await syncPlaythroughs(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on server error", async () => {
      const db = getDb();
      initializeDeviceStore();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.SERVER_ERROR,
          status: 500,
        },
      });

      await syncPlaythroughs(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("returns early on GQL error", async () => {
      const db = getDb();
      initializeDeviceStore();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: {
          code: ExecuteAuthenticatedErrorCode.GQL_ERROR,
          message: "Some error",
        },
      });

      await syncPlaythroughs(session);

      const profiles = await db.query.serverProfiles.findMany();
      expect(profiles).toHaveLength(0);
    });

    it("calls forceSignOut on unauthorized error", async () => {
      initializeDeviceStore();

      mockSyncProgress.mockResolvedValue({
        success: false,
        error: { code: ExecuteAuthenticatedErrorCode.UNAUTHORIZED },
      });

      await syncPlaythroughs(session);

      expect(mockForceSignOut).toHaveBeenCalled();
    });
  });
});
