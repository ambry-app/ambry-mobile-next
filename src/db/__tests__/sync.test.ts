/**
 * Tests for the sync functionality.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real sync service, GraphQL API, and database code runs.
 *
 * NOTE: syncPlaythroughs tests were removed during the migration to the
 * syncEvents mutation. The library sync tests below remain valid.
 * TODO: Add new tests for syncEvents once GraphQL types are regenerated.
 */

import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { getServerSyncTimestamps } from "@/db/sync-helpers";
import { syncLibrary } from "@/services/sync-service";
import { resetForTesting as resetDataVersionStore } from "@/stores/data-version";
import { resetForTesting as resetDeviceStore } from "@/stores/device";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
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
  createLibraryAuthor,
  createLibraryAuthorPerson,
  createLibraryBook,
  createLibraryBookAuthor,
  createLibraryBookUniverse,
  createLibraryDeletion,
  createLibraryMedia,
  createLibraryMediaNarrator,
  createLibraryMediaTrack,
  createLibraryNarrator,
  createLibraryPerson,
  createLibraryRecordingGroup,
  createLibrarySeries,
  createLibrarySeriesBook,
  createLibraryUniverse,
  DeletionType,
  emptyLibraryChanges,
  resetSyncFixtureIdCounter,
} from "@test/sync-fixtures";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Set up stores with test-specific initial state.
 */
function setupStores() {
  resetDataVersionStore();
  resetDeviceStore();
  resetSessionStore();

  useSession.setState({ session });
}

describe("sync", () => {
  let mockFetch: ReturnType<typeof installFetchMock>;

  beforeEach(() => {
    setupStores();
    mockFetch = installFetchMock();
    resetSyncFixtureIdCounter();
  });

  // ===========================================================================
  // getServerSyncTimestamps
  // ===========================================================================

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

  // ===========================================================================
  // syncLibrary
  // ===========================================================================

  describe("syncLibrary", () => {
    // =========================================================================
    // Happy Path: Basic sync operations
    // =========================================================================

    describe("basic sync operations", () => {
      it("syncs empty changes and updates server timestamps", async () => {
        const db = getDb();
        const serverTime = "2024-01-15T10:00:00.000Z";

        mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess(emptyLibraryChanges(firstServerTime)),
        );
        await syncLibrary(session);

        // Second sync (should pass lastSyncTime)
        mockGraphQL(
          mockFetch,
          graphqlSuccess(emptyLibraryChanges(secondServerTime)),
        );
        await syncLibrary(session);

        // Verify the API was called with the correct lastSyncTime
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // First call: no prior sync, so since is null
        const firstVars = getGraphQLVariables(mockFetch, 0);
        expect(firstVars?.since).toBeNull();

        // Second call: should use the first sync's server time
        const secondVars = getGraphQLVariables(mockFetch, 1);
        expect(secondVars?.since).toBe(firstServerTime);

        // Verify lastSyncTime was updated
        const syncedServers = await db.query.syncedServers.findMany();
        expect(syncedServers[0]!.lastSyncTime).toEqual(
          new Date(secondServerTime),
        );
      });
    });

    // =========================================================================
    // Inserting entities
    // =========================================================================

    describe("inserting entities", () => {
      it("inserts new people from server response", async () => {
        const db = getDb();
        const person = createLibraryPerson({
          id: "person-1",
          name: "John Doe",
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
          }),
        );

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
        });
        const authorPerson = createLibraryAuthorPerson({
          id: "author-person-1",
          authorId: "author-1",
          personId: "person-1",
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            authorsChangedSince: [author],
            authorPeopleChangedSince: [authorPerson],
          }),
        );

        await syncLibrary(session);

        const authors = await db.query.authors.findMany();
        expect(authors).toHaveLength(1);
        expect(authors[0]!.id).toBe("author-1");
        expect(authors[0]!.name).toBe("John Author");

        const authorPeople = await db.query.authorPeople.findMany();
        expect(authorPeople).toHaveLength(1);
        expect(authorPeople[0]!.authorId).toBe("author-1");
        expect(authorPeople[0]!.personId).toBe("person-1");
      });

      it("inserts new narrators from server response", async () => {
        const db = getDb();
        const person = createLibraryPerson({ id: "person-1" });
        const narrator = createLibraryNarrator({
          id: "narrator-1",
          name: "Jane Narrator",
          personId: "person-1",
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            narratorsChangedSince: [narrator],
          }),
        );

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
          }),
        );

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            seriesChangedSince: [series],
          }),
        );

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
            mediaChangedSince: [media],
          }),
        );

        await syncLibrary(session);

        const allMedia = await db.query.media.findMany();
        expect(allMedia).toHaveLength(1);
        expect(allMedia[0]!.id).toBe("media-1");
        expect(allMedia[0]!.bookId).toBe("book-1");
        expect(allMedia[0]!.duration).toBe("7200"); // stored as string
        expect(allMedia[0]!.publisher).toBe("Test Publisher");
      });

      it("inserts media tracks for direct-play recordings", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [createLibraryBook({ id: "book-1" })],
            mediaChangedSince: [
              createLibraryMedia({ id: "media-1", bookId: "book-1" }),
            ],
            mediaTracksChangedSince: [
              createLibraryMediaTrack({
                id: "track-2",
                mediaId: "media-1",
                index: 1,
                path: "/library/book/02.m4b",
                duration: 1800,
                startOffset: 3600,
              }),
              createLibraryMediaTrack({
                id: "track-1",
                mediaId: "media-1",
                index: 0,
                path: "/library/book/01.m4b",
                duration: 3600,
                startOffset: 0,
              }),
            ],
          }),
        );

        await syncLibrary(session);

        const tracks = await db.query.mediaTracks.findMany({
          orderBy: (t, { asc }) => asc(t.index),
        });
        expect(tracks).toHaveLength(2);
        expect(tracks[0]!.path).toBe("/library/book/01.m4b");
        expect(tracks[0]!.startOffset).toBe(0);
        expect(tracks[1]!.path).toBe("/library/book/02.m4b");
        expect(tracks[1]!.startOffset).toBe(3600);
        expect(tracks[1]!.seekAccuracy).toBe("exact");
      });

      it("inserts a set and links its recordings to it", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [createLibraryBook({ id: "book-1" })],
            recordingGroupsChangedSince: [
              createLibraryRecordingGroup({
                id: "set-1",
                bookId: "book-1",
                partsTotal: 3,
                partWord: "volume",
                partWordPlural: "volumes",
              }),
            ],
            mediaChangedSince: [
              createLibraryMedia({
                id: "media-1",
                bookId: "book-1",
                partNumber: 2,
                recordingGroup: { __typename: "RecordingGroup", id: "set-1" },
              }),
            ],
          }),
        );

        await syncLibrary(session);

        const sets = await db.query.recordingGroups.findMany();
        expect(sets).toHaveLength(1);
        expect(sets[0]!.partsTotal).toBe(3);
        expect(sets[0]!.partWord).toBe("volume");
        expect(sets[0]!.partWordPlural).toBe("volumes");

        const allMedia = await db.query.media.findMany();
        expect(allMedia[0]!.recordingGroupId).toBe("set-1");
        expect(allMedia[0]!.partNumber).toBe(2);
      });

      it("stores a recording's own title as an override", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [
              createLibraryBook({ id: "book-1", title: "Leviathan Wakes" }),
            ],
            mediaChangedSince: [
              createLibraryMedia({
                id: "media-1",
                bookId: "book-1",
                title: "Der Kalte Krieg",
              }),
              createLibraryMedia({ id: "media-2", bookId: "book-1" }),
            ],
          }),
        );

        await syncLibrary(session);

        const allMedia = await db.query.media.findMany({
          orderBy: (m, { asc }) => asc(m.id),
        });
        expect(allMedia[0]!.title).toBe("Der Kalte Krieg");
        expect(allMedia[1]!.title).toBeNull();
      });

      it("inserts universes and their book links", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [createLibraryBook({ id: "book-1" })],
            universesChangedSince: [
              createLibraryUniverse({ id: "universe-1", name: "The Cosmere" }),
            ],
            bookUniversesChangedSince: [
              createLibraryBookUniverse({
                id: "book-universe-1",
                bookId: "book-1",
                universeId: "universe-1",
              }),
            ],
          }),
        );

        await syncLibrary(session);

        const universes = await db.query.universes.findMany();
        expect(universes).toHaveLength(1);
        expect(universes[0]!.name).toBe("The Cosmere");

        const links = await db.query.bookUniverses.findMany();
        expect(links).toHaveLength(1);
        expect(links[0]!.bookId).toBe("book-1");
        expect(links[0]!.universeId).toBe("universe-1");
      });

      it("removes rows the server no longer has on a full fetch", async () => {
        const db = getDb();

        // first sync: two books, each with a recording
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges("2024-01-15T10:00:00.000Z"),
            booksChangedSince: [
              createLibraryBook({ id: "keeper" }),
              createLibraryBook({ id: "goner" }),
            ],
            mediaChangedSince: [
              createLibraryMedia({ id: "media-keeper", bookId: "keeper" }),
              createLibraryMedia({ id: "media-goner", bookId: "goner" }),
            ],
          }),
        );
        await syncLibrary(session);
        expect(await db.query.books.findMany()).toHaveLength(2);

        // the cursor is cleared, as the schema migration does, and one book has
        // been deleted on the server in the meantime. A full fetch carries no
        // deletion records, so its absence is the only evidence.
        await db
          .update(schema.syncedServers)
          .set({ lastSyncTime: null })
          .where(eq(schema.syncedServers.url, session.url));

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges("2024-01-15T11:00:00.000Z"),
            booksChangedSince: [createLibraryBook({ id: "keeper" })],
            mediaChangedSince: [
              createLibraryMedia({ id: "media-keeper", bookId: "keeper" }),
            ],
          }),
        );
        await syncLibrary(session);

        expect((await db.query.books.findMany()).map((b) => b.id)).toEqual([
          "keeper",
        ]);
        expect((await db.query.media.findMany()).map((m) => m.id)).toEqual([
          "media-keeper",
        ]);
      });

      it("leaves untouched rows alone during an incremental sync", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges("2024-01-15T10:00:00.000Z"),
            booksChangedSince: [
              createLibraryBook({ id: "book-1" }),
              createLibraryBook({ id: "book-2" }),
            ],
          }),
        );
        await syncLibrary(session);

        // an incremental sync only mentions what changed; everything else must
        // survive, which is exactly what reconciliation must not touch
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges("2024-01-15T11:00:00.000Z"),
            booksChangedSince: [
              createLibraryBook({ id: "book-1", title: "Renamed" }),
            ],
          }),
        );
        await syncLibrary(session);

        const books = await db.query.books.findMany({
          orderBy: (b, { asc }) => asc(b.id),
        });
        expect(books.map((b) => b.id)).toEqual(["book-1", "book-2"]);
        expect(books[0]!.title).toBe("Renamed");
      });

      it("does not touch another server's rows when reconciling", async () => {
        const db = getDb();

        await db.insert(schema.books).values({
          url: "https://other-server.com",
          id: "other-book",
          title: "Other",
          published: new Date(),
          publishedFormat: "full",
          insertedAt: new Date(),
          updatedAt: new Date(),
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [createLibraryBook({ id: "ours" })],
          }),
        );
        await syncLibrary(session);

        const books = await db.query.books.findMany();
        expect(books.map((b) => b.id).sort()).toEqual(["other-book", "ours"]);
      });

      it("inserts book-author relationships", async () => {
        const db = getDb();
        const person = createLibraryPerson({ id: "person-1" });
        const author = createLibraryAuthor({
          id: "author-1",
        });
        const book = createLibraryBook({ id: "book-1" });
        const bookAuthor = createLibraryBookAuthor({
          id: "ba-1",
          bookId: "book-1",
          authorId: "author-1",
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            authorsChangedSince: [author],
            booksChangedSince: [book],
            bookAuthorsChangedSince: [bookAuthor],
          }),
        );

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
            seriesChangedSince: [series],
            seriesBooksChangedSince: [seriesBook],
          }),
        );

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            narratorsChangedSince: [narrator],
            booksChangedSince: [book],
            mediaChangedSince: [media],
            mediaNarratorsChangedSince: [mediaNarrator],
          }),
        );

        await syncLibrary(session);

        const mediaNarrators = await db.query.mediaNarrators.findMany();
        expect(mediaNarrators).toHaveLength(1);
        expect(mediaNarrators[0]!.mediaId).toBe("media-1");
        expect(mediaNarrators[0]!.narratorId).toBe("narrator-1");
      });
    });

    // =========================================================================
    // Updating entities (upsert behavior)
    // =========================================================================

    describe("updating entities", () => {
      it("updates existing person when syncing", async () => {
        const db = getDb();
        const serverTime1 = "2024-01-15T10:00:00.000Z";
        const serverTime2 = "2024-01-15T11:00:00.000Z";

        // First sync: insert person
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(serverTime1),
            peopleChangedSince: [
              createLibraryPerson({ id: "person-1", name: "John" }),
            ],
          }),
        );
        await syncLibrary(session);

        // Second sync: update person
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(serverTime2),
            peopleChangedSince: [
              createLibraryPerson({
                id: "person-1",
                name: "John Updated",
                description: "A description",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const people = await db.query.people.findMany();
        expect(people).toHaveLength(1);
        expect(people[0]!.name).toBe("John Updated");
        expect(people[0]!.description).toBe("A description");
      });

      it("updates existing book when syncing", async () => {
        const db = getDb();

        // First sync
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [
              createLibraryBook({ id: "book-1", title: "Original Title" }),
            ],
          }),
        );
        await syncLibrary(session);

        // Second sync
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [
              createLibraryBook({ id: "book-1", title: "New Title" }),
            ],
          }),
        );
        await syncLibrary(session);

        const books = await db.query.books.findMany();
        expect(books).toHaveLength(1);
        expect(books[0]!.title).toBe("New Title");
      });

      it("updates media-narrator when the narrator is changed on the server", async () => {
        const db = getDb();
        const person = createLibraryPerson({ id: "person-1" });
        const narrator1 = createLibraryNarrator({
          id: "narrator-1",
          personId: "person-1",
        });
        const narrator2 = createLibraryNarrator({
          id: "narrator-2",
          personId: "person-1",
        });
        const book = createLibraryBook({ id: "book-1" });
        const media = createLibraryMedia({ id: "media-1", bookId: "book-1" });

        // First sync: media narrated by narrator-1
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            narratorsChangedSince: [narrator1, narrator2],
            booksChangedSince: [book],
            mediaChangedSince: [media],
            mediaNarratorsChangedSince: [
              createLibraryMediaNarrator({
                id: "mn-1",
                mediaId: "media-1",
                narratorId: "narrator-1",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        // Second sync: the same join row now points at narrator-2
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            mediaNarratorsChangedSince: [
              createLibraryMediaNarrator({
                id: "mn-1",
                mediaId: "media-1",
                narratorId: "narrator-2",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const mediaNarrators = await db.query.mediaNarrators.findMany();
        expect(mediaNarrators).toHaveLength(1);
        expect(mediaNarrators[0]!.narratorId).toBe("narrator-2");
      });

      it("updates book-author when the author is changed on the server", async () => {
        const db = getDb();
        const person = createLibraryPerson({ id: "person-1" });
        const author1 = createLibraryAuthor({
          id: "author-1",
        });
        const author2 = createLibraryAuthor({
          id: "author-2",
        });
        const book = createLibraryBook({ id: "book-1" });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            authorsChangedSince: [author1, author2],
            booksChangedSince: [book],
            bookAuthorsChangedSince: [
              createLibraryBookAuthor({
                id: "ba-1",
                bookId: "book-1",
                authorId: "author-1",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            bookAuthorsChangedSince: [
              createLibraryBookAuthor({
                id: "ba-1",
                bookId: "book-1",
                authorId: "author-2",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const bookAuthors = await db.query.bookAuthors.findMany();
        expect(bookAuthors).toHaveLength(1);
        expect(bookAuthors[0]!.authorId).toBe("author-2");
      });

      it("updates series-book when the series is changed on the server", async () => {
        const db = getDb();
        const book = createLibraryBook({ id: "book-1" });
        const series1 = createLibrarySeries({ id: "series-1" });
        const series2 = createLibrarySeries({ id: "series-2" });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
            seriesChangedSince: [series1, series2],
            seriesBooksChangedSince: [
              createLibrarySeriesBook({
                id: "sb-1",
                bookId: "book-1",
                seriesId: "series-1",
                bookNumber: "3",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            seriesBooksChangedSince: [
              createLibrarySeriesBook({
                id: "sb-1",
                bookId: "book-1",
                seriesId: "series-2",
                bookNumber: "1.5",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const seriesBooks = await db.query.seriesBooks.findMany();
        expect(seriesBooks).toHaveLength(1);
        expect(seriesBooks[0]!.seriesId).toBe("series-2");
        expect(seriesBooks[0]!.bookNumber).toBe("1.5");
      });

      it("updates author's person when changed on the server", async () => {
        const db = getDb();
        const person1 = createLibraryPerson({ id: "person-1" });
        const person2 = createLibraryPerson({ id: "person-2" });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person1, person2],
            authorsChangedSince: [createLibraryAuthor({ id: "author-1" })],
            authorPeopleChangedSince: [
              createLibraryAuthorPerson({
                id: "author-person-1",
                authorId: "author-1",
                personId: "person-1",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            authorPeopleChangedSince: [
              createLibraryAuthorPerson({
                id: "author-person-1",
                authorId: "author-1",
                personId: "person-2",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const authorPeople = await db.query.authorPeople.findMany();
        expect(authorPeople).toHaveLength(1);
        expect(authorPeople[0]!.personId).toBe("person-2");
      });

      it("links one byline to several people for a composite pen name", async () => {
        const db = getDb();

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [
              createLibraryPerson({ id: "person-1" }),
              createLibraryPerson({ id: "person-2" }),
            ],
            authorsChangedSince: [
              createLibraryAuthor({ id: "author-1", name: "James S.A. Corey" }),
            ],
            authorPeopleChangedSince: [
              createLibraryAuthorPerson({
                id: "author-person-1",
                authorId: "author-1",
                personId: "person-1",
              }),
              createLibraryAuthorPerson({
                id: "author-person-2",
                authorId: "author-1",
                personId: "person-2",
              }),
            ],
          }),
        );
        await syncLibrary(session);

        const authors = await db.query.authors.findMany();
        expect(authors).toHaveLength(1);

        const authorPeople = await db.query.authorPeople.findMany();
        expect(authorPeople.map((link) => link.personId).sort()).toEqual([
          "person-1",
          "person-2",
        ]);
      });

      it("updates narrator's person when changed on the server", async () => {
        const db = getDb();
        const person1 = createLibraryPerson({ id: "person-1" });
        const person2 = createLibraryPerson({ id: "person-2" });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person1, person2],
            narratorsChangedSince: [
              createLibraryNarrator({ id: "narrator-1", personId: "person-1" }),
            ],
          }),
        );
        await syncLibrary(session);

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            narratorsChangedSince: [
              createLibraryNarrator({ id: "narrator-1", personId: "person-2" }),
            ],
          }),
        );
        await syncLibrary(session);

        const narrators = await db.query.narrators.findMany();
        expect(narrators).toHaveLength(1);
        expect(narrators[0]!.personId).toBe("person-2");
      });
    });

    // =========================================================================
    // Deletions
    // =========================================================================

    describe("deletions", () => {
      it("deletes person when deletion received", async () => {
        const db = getDb();

        // First sync: insert person
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
          }),
        );
        await syncLibrary(session);

        // Verify person exists
        let people = await db.query.people.findMany();
        expect(people).toHaveLength(1);

        // Second sync: delete person
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            deletionsSince: [
              createLibraryDeletion(DeletionType.Person, "person-1"),
            ],
          }),
        );
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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
            mediaChangedSince: [media],
          }),
        );
        await syncLibrary(session);

        // Verify media exists
        let allMedia = await db.query.media.findMany();
        expect(allMedia).toHaveLength(1);

        // Second sync: delete media
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            deletionsSince: [
              createLibraryDeletion(DeletionType.Media, "media-1"),
            ],
          }),
        );
        await syncLibrary(session);

        // Verify media deleted
        allMedia = await db.query.media.findMany();
        expect(allMedia).toHaveLength(0);
      });

      it("handles multiple deletion types in one sync", async () => {
        const db = getDb();

        // First sync: insert entities
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
            booksChangedSince: [createLibraryBook({ id: "book-1" })],
            seriesChangedSince: [createLibrarySeries({ id: "series-1" })],
          }),
        );
        await syncLibrary(session);

        // Second sync: delete all
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            deletionsSince: [
              createLibraryDeletion(DeletionType.Person, "person-1"),
              createLibraryDeletion(DeletionType.Book, "book-1"),
              createLibraryDeletion(DeletionType.Series, "series-1"),
            ],
          }),
        );
        await syncLibrary(session);

        expect(await db.query.people.findMany()).toHaveLength(0);
        expect(await db.query.books.findMany()).toHaveLength(0);
        expect(await db.query.series.findMany()).toHaveLength(0);
      });
    });

    // =========================================================================
    // Error handling
    // =========================================================================

    describe("error handling", () => {
      it("returns early on network error without DB changes", async () => {
        const db = getDb();

        mockNetworkError(mockFetch, "Network error");

        await syncLibrary(session);

        const servers = await db.query.syncedServers.findMany();
        expect(servers).toHaveLength(0);
      });

      it("clears session on unauthorized error", async () => {
        mockGraphQL(mockFetch, graphqlUnauthorized());

        await syncLibrary(session);

        // Session should be cleared
        const { session: currentSession } = useSession.getState();
        expect(currentSession).toBeNull();
      });

      it("does not update DB on unauthorized error", async () => {
        const db = getDb();

        mockGraphQL(mockFetch, graphqlUnauthorized());

        await syncLibrary(session);

        const servers = await db.query.syncedServers.findMany();
        expect(servers).toHaveLength(0);
      });
    });

    // =========================================================================
    // Timestamp tracking (libraryDataVersion)
    // =========================================================================

    describe("timestamp tracking", () => {
      it("sets libraryDataVersion to serverTime on first sync", async () => {
        const db = getDb();
        const serverTime = "2024-01-15T10:00:00.000Z";

        mockGraphQL(mockFetch, graphqlSuccess(emptyLibraryChanges(serverTime)));

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess(emptyLibraryChanges(serverTime1)),
        );
        await syncLibrary(session);

        // Second sync with new data
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(serverTime2),
            peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
          }),
        );
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
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(serverTime1),
            peopleChangedSince: [createLibraryPerson({ id: "person-1" })],
          }),
        );
        await syncLibrary(session);

        // Second sync without new data
        mockGraphQL(
          mockFetch,
          graphqlSuccess(emptyLibraryChanges(serverTime2)),
        );
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

    // =========================================================================
    // Large libraries
    // =========================================================================

    describe("large libraries", () => {
      // A multi-row insert binds one parameter per column per row, and SQLite
      // caps a statement at SQLITE_MAX_VARIABLE_NUMBER (32766) parameters. A
      // first sync sends the whole library at once, so these batches have to be
      // split up or the insert fails with "too many SQL variables".

      it("inserts more media than fit in a single statement", async () => {
        const db = getDb();
        const book = createLibraryBook({ id: "book-1" });
        // media is the widest table (21 columns), so it overflows first
        const media = Array.from({ length: 2000 }, (_, i) =>
          createLibraryMedia({ id: `media-${i}`, bookId: "book-1" }),
        );

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            booksChangedSince: [book],
            mediaChangedSince: media,
          }),
        );

        await syncLibrary(session);

        const allMedia = await db.query.media.findMany();
        expect(allMedia).toHaveLength(2000);
      });

      it("inserts more people than fit in a single statement", async () => {
        const db = getDb();
        const people = Array.from({ length: 5000 }, (_, i) =>
          createLibraryPerson({ id: `person-${i}` }),
        );

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: people,
          }),
        );

        await syncLibrary(session);

        const allPeople = await db.query.people.findMany();
        expect(allPeople).toHaveLength(5000);
      });
    });
  });

  // ===========================================================================
  // syncPlaythroughs (syncEvents) - Tests TODO
  // ===========================================================================

  // NOTE: The syncPlaythroughs tests have been removed during the migration
  // from syncProgress to syncEvents. Once the GraphQL types are regenerated,
  // new tests should be added for the syncEvents mutation.
  //
  // Key behaviors to test:
  // - Sends unsynced events to server
  // - Marks sent events as synced
  // - Receives new events from server
  // - Rebuilds affected playthroughs from received events
  // - Error handling (network, unauthorized)
});
