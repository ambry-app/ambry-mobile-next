import { useTestDatabase } from "@test/db-test-utils";
import {
  createPerson,
  createAuthor,
  createNarrator,
  createBook,
  createSeries,
  createSeriesBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  createPlaythrough,
  createPlaybackEvent,
  createPlaythroughStateCache,
  createDownload,
  createSyncedServer,
  createServerProfile,
  createLocalUserSettings,
  createShelvedMedia,
  DEFAULT_TEST_SESSION,
  resetIdCounter,
} from "@test/factories";

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  randomUUID: () => "test-uuid-" + Math.random().toString(36).substring(7),
}));

describe("test factories", () => {
  const { getDb } = useTestDatabase();

  beforeEach(() => {
    resetIdCounter();
  });

  describe("people, authors, narrators", () => {
    it("creates a person with defaults", async () => {
      const db = getDb();
      const person = await createPerson(db);

      expect(person.id).toBe("person-1");
      expect(person.name).toBe("Person person-1");
      expect(person.url).toBe(DEFAULT_TEST_SESSION.url);
    });

    it("creates a person with overrides", async () => {
      const db = getDb();
      const person = await createPerson(db, {
        id: "custom-person",
        name: "Jane Doe",
      });

      expect(person.id).toBe("custom-person");
      expect(person.name).toBe("Jane Doe");
    });

    it("creates an author with auto-created person", async () => {
      const db = getDb();
      const author = await createAuthor(db);

      expect(author.id).toBe("author-1");
      // Person is auto-created, so just verify it exists
      expect(author.personId).toMatch(/^person-/);
    });

    it("creates an author with existing person", async () => {
      const db = getDb();
      const person = await createPerson(db, { id: "existing-person" });
      const author = await createAuthor(db, { personId: person.id });

      expect(author.personId).toBe("existing-person");
    });

    it("creates a narrator with auto-created person", async () => {
      const db = getDb();
      const narrator = await createNarrator(db);

      expect(narrator.id).toBe("narrator-1");
      // Person is auto-created, so just verify it exists
      expect(narrator.personId).toMatch(/^person-/);
    });
  });

  describe("books and series", () => {
    it("creates a book with defaults", async () => {
      const db = getDb();
      const book = await createBook(db);

      expect(book.id).toBe("book-1");
      expect(book.title).toBe("Book book-1");
      expect(book.publishedFormat).toBe("full");
    });

    it("creates a series with defaults", async () => {
      const db = getDb();
      const series = await createSeries(db);

      expect(series.id).toBe("series-1");
      expect(series.name).toBe("Series series-1");
    });

    it("creates a series book linking book and series", async () => {
      const db = getDb();
      const seriesBook = await createSeriesBook(db, { bookNumber: "3" });

      // Book and series are auto-created, so just verify they exist
      expect(seriesBook.bookId).toMatch(/^book-/);
      expect(seriesBook.seriesId).toMatch(/^series-/);
      expect(seriesBook.bookNumber).toBe("3");
    });

    it("creates a book author linking book and author", async () => {
      const db = getDb();
      const bookAuthor = await createBookAuthor(db);

      // Book and author are auto-created, so just verify they exist
      expect(bookAuthor.bookId).toMatch(/^book-/);
      expect(bookAuthor.authorId).toMatch(/^author-/);
    });
  });

  describe("media", () => {
    it("creates media with auto-created book", async () => {
      const db = getDb();
      const media = await createMedia(db);

      expect(media.id).toBe("media-1");
      // Book is auto-created, so just verify it exists
      expect(media.bookId).toMatch(/^book-/);
      expect(media.chapters).toEqual([]);
      expect(media.supplementalFiles).toEqual([]);
    });

    it("creates media with custom book", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        book: { title: "Custom Book" },
      });

      // Book is auto-created with custom title
      expect(media.bookId).toMatch(/^book-/);

      const book = await db.query.books.findFirst({
        where: (b, { eq }) => eq(b.id, media.bookId),
      });
      expect(book?.title).toBe("Custom Book");
    });

    it("creates media with chapters", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        chapters: [
          { id: "ch1", title: "Chapter 1", startTime: 0 },
          { id: "ch2", title: "Chapter 2", startTime: 1000 },
        ],
      });

      expect(media.chapters).toHaveLength(2);
      expect(media.chapters[0]?.title).toBe("Chapter 1");
    });

    it("creates media narrator linking media and narrator", async () => {
      const db = getDb();
      const mediaNarrator = await createMediaNarrator(db);

      // Media and narrator are auto-created, so just verify they exist
      expect(mediaNarrator.mediaId).toMatch(/^media-/);
      expect(mediaNarrator.narratorId).toMatch(/^narrator-/);
    });
  });

  describe("playthroughs and events", () => {
    it("creates a playthrough with auto-created media", async () => {
      const db = getDb();
      const playthrough = await createPlaythrough(db);

      expect(playthrough.id).toBe("playthrough-1");
      // Media is auto-created, so just verify it exists
      expect(playthrough.mediaId).toMatch(/^media-/);
      expect(playthrough.status).toBe("in_progress");
      expect(playthrough.userEmail).toBe(DEFAULT_TEST_SESSION.email);
    });

    it("creates a playthrough with custom status", async () => {
      const db = getDb();
      const playthrough = await createPlaythrough(db, { status: "finished" });

      expect(playthrough.status).toBe("finished");
    });

    it("creates a playback event with auto-created playthrough", async () => {
      const db = getDb();
      const event = await createPlaybackEvent(db);

      expect(event.id).toBe("event-1");
      // Playthrough is auto-created, so just verify it exists
      expect(event.playthroughId).toMatch(/^playthrough-/);
      expect(event.type).toBe("play");
    });

    it("creates a playback event with custom type", async () => {
      const db = getDb();
      const event = await createPlaybackEvent(db, {
        type: "pause",
        position: 123.45,
      });

      expect(event.type).toBe("pause");
      expect(event.position).toBe(123.45);
    });

    it("creates a playthrough state cache", async () => {
      const db = getDb();
      const cache = await createPlaythroughStateCache(db, {
        currentPosition: 500,
        currentRate: 1.5,
      });

      // Playthrough is auto-created, so just verify it exists
      expect(cache.playthroughId).toMatch(/^playthrough-/);
      expect(cache.currentPosition).toBe(500);
      expect(cache.currentRate).toBe(1.5);
    });
  });

  describe("downloads", () => {
    it("creates a download with auto-created media", async () => {
      const db = getDb();
      const download = await createDownload(db);

      // Media is auto-created, so just verify it exists
      expect(download.mediaId).toMatch(/^media-/);
      expect(download.status).toBe("ready");
      expect(download.filePath).toBe(`/downloads/${download.mediaId}.mp4`);
    });

    it("creates a download with custom status", async () => {
      const db = getDb();
      const download = await createDownload(db, { status: "pending" });

      expect(download.status).toBe("pending");
    });
  });

  describe("sync metadata", () => {
    it("creates a synced server", async () => {
      const db = getDb();
      const syncedServer = await createSyncedServer(db, {
        lastDownSync: new Date("2024-01-01"),
      });

      expect(syncedServer.url).toBe(DEFAULT_TEST_SESSION.url);
      expect(syncedServer.lastDownSync).toBeDefined();
    });

    it("creates a server profile", async () => {
      const db = getDb();
      const profile = await createServerProfile(db);

      expect(profile.url).toBe(DEFAULT_TEST_SESSION.url);
      expect(profile.userEmail).toBe(DEFAULT_TEST_SESSION.email);
    });
  });

  describe("user settings", () => {
    it("creates local user settings with defaults", async () => {
      const db = getDb();
      const settings = await createLocalUserSettings(db);

      expect(settings.userEmail).toBe(DEFAULT_TEST_SESSION.email);
      expect(settings.preferredPlaybackRate).toBe(1);
    });

    it("creates local user settings with overrides", async () => {
      const db = getDb();
      const settings = await createLocalUserSettings(db, {
        preferredPlaybackRate: 1.5,
        sleepTimerEnabled: true,
      });

      expect(settings.preferredPlaybackRate).toBe(1.5);
      expect(settings.sleepTimerEnabled).toBe(true);
    });
  });

  describe("shelved media", () => {
    it("creates shelved media with auto-created media", async () => {
      const db = getDb();
      const shelved = await createShelvedMedia(db);

      // Media is auto-created, so just verify it exists
      expect(shelved.mediaId).toMatch(/^media-/);
      expect(shelved.shelfName).toBe("Want to Listen");
      expect(shelved.synced).toBe(false);
    });

    it("creates shelved media with custom shelf", async () => {
      const db = getDb();
      const shelved = await createShelvedMedia(db, {
        shelfName: "Favorites",
        priority: 5,
      });

      expect(shelved.shelfName).toBe("Favorites");
      expect(shelved.priority).toBe(5);
    });
  });

  describe("multi-tenant isolation", () => {
    it("creates entities on different servers", async () => {
      const db = getDb();

      const media1 = await createMedia(db, { url: "http://server1.com" });
      const media2 = await createMedia(db, { url: "http://server2.com" });

      expect(media1.url).toBe("http://server1.com");
      expect(media2.url).toBe("http://server2.com");

      // Both should have different IDs (counter increments for each entity)
      expect(media1.id).toMatch(/^media-/);
      expect(media2.id).toMatch(/^media-/);
      expect(media1.id).not.toBe(media2.id);
    });
  });
});
