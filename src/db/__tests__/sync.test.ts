/**
 * Tests for the sync functionality.
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (expo-secure-store, expo-file-system, etc.)
 * - Network boundary (fetch)
 *
 * The real sync service, GraphQL API, and database code runs.
 */

import * as schema from "@/db/schema";
import { getServerSyncTimestamps } from "@/db/sync-helpers";
import { syncLibrary, syncPlaythroughs } from "@/services/sync-service";
import { resetForTesting as resetDataVersionStore } from "@/stores/data-version";
import {
  resetForTesting as resetDeviceStore,
  useDevice,
} from "@/stores/device";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import { DeviceInfo } from "@/types/device-info";
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

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

const MOCK_DEVICE_INFO: DeviceInfo = {
  id: "test-device-id",
  type: "android",
  brand: "TestBrand",
  modelName: "TestModel",
  osName: "Android",
  osVersion: "14",
  appId: "app.ambry.mobile.dev",
  appVersion: "1.0.0",
  appBuild: "1",
};

/**
 * Set up stores with test-specific initial state.
 */
function setupStores() {
  resetDataVersionStore();
  resetDeviceStore();
  resetSessionStore();

  useSession.setState({ session });
  useDevice.setState({
    initialized: true,
    deviceInfo: MOCK_DEVICE_INFO,
  });
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
          personId: "person-1",
        });

        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            ...emptyLibraryChanges(),
            peopleChangedSince: [person],
            authorsChangedSince: [author],
          }),
        );

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
  });

  // ===========================================================================
  // syncPlaythroughs
  // ===========================================================================

  describe("syncPlaythroughs", () => {
    // Helper to create media in DB first (needed for FK constraints)
    async function setupMediaInDb() {
      mockGraphQL(
        mockFetch,
        graphqlSuccess({
          ...emptyLibraryChanges(),
          booksChangedSince: [createLibraryBook({ id: "book-1" })],
          mediaChangedSince: [
            createLibraryMedia({ id: "media-1", bookId: "book-1" }),
            createLibraryMedia({ id: "media-2", bookId: "book-1" }),
          ],
        }),
      );
      await syncLibrary(session);
    }

    // =========================================================================
    // Empty sync
    // =========================================================================

    describe("empty sync", () => {
      it("calls API with empty playthroughs and events when nothing to sync", async () => {
        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult() }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const vars = getGraphQLVariables(mockFetch, 0);
        expect(vars?.input).toBeDefined();
        const input = vars!.input as {
          playthroughs: unknown[];
          events: unknown[];
        };
        expect(input.playthroughs).toHaveLength(0);
        expect(input.events).toHaveLength(0);
      });

      it("updates server profile lastSyncTime on empty sync", async () => {
        const db = getDb();

        const serverTime = "2024-01-15T10:00:00.000Z";
        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const profiles = await db.query.serverProfiles.findMany();
        expect(profiles).toHaveLength(1);
        expect(profiles[0]!.lastSyncTime).toEqual(new Date(serverTime));
      });
    });

    // =========================================================================
    // Up-sync: Sending playthroughs and events to server
    // =========================================================================

    describe("up-sync", () => {
      it("sends unsynced playthroughs to server", async () => {
        const db = getDb();

        await setupMediaInDb();

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult() }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        // Get the second call (first was setupMediaInDb)
        const vars = getGraphQLVariables(mockFetch, 1);
        expect(vars?.input).toBeDefined();
        const input = vars!.input as {
          playthroughs: {
            id: string;
            mediaId: string;
            status: string;
          }[];
        };
        expect(input.playthroughs).toHaveLength(1);
        expect(input.playthroughs[0]!.id).toBe("playthrough-1");
        expect(input.playthroughs[0]!.mediaId).toBe("media-1");
        expect(input.playthroughs[0]!.status).toBe("IN_PROGRESS");
      });

      it("sends unsynced events to server", async () => {
        const db = getDb();

        await setupMediaInDb();

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

        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult() }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        // Get the second call (first was setupMediaInDb)
        const vars = getGraphQLVariables(mockFetch, 1);
        expect(vars?.input).toBeDefined();
        const input = vars!.input as {
          events: { id: string; type: string }[];
        };
        expect(input.events).toHaveLength(1);
        expect(input.events[0]!.id).toBe("event-1");
        expect(input.events[0]!.type).toBe("PLAY");
      });

      it("marks playthroughs as synced after successful sync", async () => {
        const db = getDb();

        await setupMediaInDb();

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const playthroughs = await db.query.playthroughs.findMany();
        expect(playthroughs[0]!.syncedAt).toEqual(new Date(serverTime));
      });

      it("marks events as synced after successful sync", async () => {
        const db = getDb();

        await setupMediaInDb();

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess({ syncProgress: emptySyncProgressResult(serverTime) }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const events = await db.query.playbackEvents.findMany();
        expect(events[0]!.syncedAt).toEqual(new Date(serverTime));
      });
    });

    // =========================================================================
    // Down-sync: Receiving playthroughs and events from server
    // =========================================================================

    describe("down-sync", () => {
      it("upserts received playthroughs from server", async () => {
        const db = getDb();

        await setupMediaInDb();

        const serverTime = "2024-01-15T10:00:00.000Z";
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
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
          }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const playthroughs = await db.query.playthroughs.findMany();
        expect(playthroughs).toHaveLength(1);
        expect(playthroughs[0]!.id).toBe("server-playthrough-1");
        expect(playthroughs[0]!.mediaId).toBe("media-1");
        expect(playthroughs[0]!.status).toBe("in_progress");
      });

      it("upserts received events from server", async () => {
        const db = getDb();

        await setupMediaInDb();

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
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
          }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const events = await db.query.playbackEvents.findMany();
        expect(events).toHaveLength(1);
        expect(events[0]!.id).toBe("server-event-1");
        expect(events[0]!.type).toBe("pause");
        expect(events[0]!.position).toBe(500);
      });

      it("updates state cache for received events with position", async () => {
        const db = getDb();

        await setupMediaInDb();

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
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
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
          }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const cache = await db.query.playthroughStateCache.findFirst({
          where: (t, { eq }) => eq(t.playthroughId, "playthrough-1"),
        });
        expect(cache).not.toBeNull();
        expect(cache!.currentPosition).toBe(750);
        expect(cache!.currentRate).toBe(1.5);
      });

      it("handles out-of-order events correctly by using newest timestamp", async () => {
        const db = getDb();

        await setupMediaInDb();

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

        const serverTime = "2024-01-15T12:00:00.000Z";

        // Events arrive OUT OF ORDER: newer event first, older event second
        // This tests that we correctly use the newest event's position,
        // not the last-processed event's position
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            syncProgress: {
              ...emptySyncProgressResult(serverTime),
              events: [
                // Newer event (3pm) - position 500
                createSyncPlaybackEvent({
                  id: "event-newer",
                  playthroughId: "playthrough-1",
                  type: PlaybackEventType.Pause,
                  timestamp: "2024-01-15T15:00:00.000Z",
                  position: 500,
                  playbackRate: 1.5,
                }),
                // Older event (2pm) - position 1000
                createSyncPlaybackEvent({
                  id: "event-older",
                  playthroughId: "playthrough-1",
                  type: PlaybackEventType.Play,
                  timestamp: "2024-01-15T14:00:00.000Z",
                  position: 1000,
                  playbackRate: 1.0,
                }),
              ],
            },
          }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        // State cache should have position from the NEWER event (500),
        // not the last-processed event (1000)
        const cache = await db.query.playthroughStateCache.findFirst({
          where: (t, { eq }) => eq(t.playthroughId, "playthrough-1"),
        });
        expect(cache).not.toBeNull();
        expect(cache!.currentPosition).toBe(500);
        expect(cache!.currentRate).toBe(1.5);
        expect(cache!.lastEventAt).toEqual(
          new Date("2024-01-15T15:00:00.000Z"),
        );
      });

      it("does not overwrite newer local state cache with older server events", async () => {
        const db = getDb();

        await setupMediaInDb();

        // Create local playthrough with existing state cache
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

        // Local state cache is more recent (4pm)
        await db.insert(schema.playthroughStateCache).values({
          playthroughId: "playthrough-1",
          currentPosition: 2000,
          currentRate: 2.0,
          lastEventAt: new Date("2024-01-15T16:00:00.000Z"),
          updatedAt: now,
        });

        const serverTime = "2024-01-15T12:00:00.000Z";

        // Server sends an older event (3pm)
        mockGraphQL(
          mockFetch,
          graphqlSuccess({
            syncProgress: {
              ...emptySyncProgressResult(serverTime),
              events: [
                createSyncPlaybackEvent({
                  id: "event-older-from-server",
                  playthroughId: "playthrough-1",
                  type: PlaybackEventType.Pause,
                  timestamp: "2024-01-15T15:00:00.000Z",
                  position: 500,
                  playbackRate: 1.0,
                }),
              ],
            },
          }),
        );

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        // State cache should NOT be overwritten - local is newer
        const cache = await db.query.playthroughStateCache.findFirst({
          where: (t, { eq }) => eq(t.playthroughId, "playthrough-1"),
        });
        expect(cache).not.toBeNull();
        expect(cache!.currentPosition).toBe(2000);
        expect(cache!.currentRate).toBe(2.0);
        expect(cache!.lastEventAt).toEqual(
          new Date("2024-01-15T16:00:00.000Z"),
        );
      });
    });

    // =========================================================================
    // Error handling
    // =========================================================================

    describe("error handling", () => {
      it("returns early on network error", async () => {
        const db = getDb();

        mockNetworkError(mockFetch, "Network error");

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        const profiles = await db.query.serverProfiles.findMany();
        expect(profiles).toHaveLength(0);
      });

      it("clears session on unauthorized error", async () => {
        mockGraphQL(mockFetch, graphqlUnauthorized());

        await syncPlaythroughs(session, MOCK_DEVICE_INFO);

        // Session should be cleared
        const { session: currentSession } = useSession.getState();
        expect(currentSession).toBeNull();
      });
    });
  });
});
