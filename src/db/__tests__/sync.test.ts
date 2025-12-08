import { syncDownLibrary } from "@/db/sync";
import { ExecuteAuthenticatedErrorCode } from "@/graphql/client/execute";
import { initialDataVersionState, useDataVersion } from "@/stores/data-version";
import { setupTestDatabase } from "@test/db-test-utils";
import { DEFAULT_TEST_SESSION } from "@test/factories";
import { mockForceSignOut, mockGetLibraryChangesSince } from "@test/jest-setup";
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
  DeletionType,
  emptyLibraryChanges,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

// Reset data-version store between tests
resetStoreBeforeEach(useDataVersion, initialDataVersionState);

describe("syncDownLibrary", () => {
  beforeEach(() => {
    mockGetLibraryChangesSince.mockReset();
    mockForceSignOut.mockReset();
    resetSyncFixtureIdCounter();
  });

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
