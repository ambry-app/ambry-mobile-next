/**
 * Tests for getMediaPage and getSearchedMedia query functions.
 */

import { getMediaPage, getSearchedMedia } from "@/db/library/get-media-page";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  createRecordingGroup,
  createSeries,
  createSeriesBook,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getMediaPage", () => {
  it("returns empty array when no media exists", async () => {
    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result).toEqual([]);
  });

  it("returns recent media with book info", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, {
      bookId: book.id,
      status: "ready",
    });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.id).toBe(media.id);
    expect(result[0]?.representative.book.title).toBe("Pride and Prejudice");
  });

  it("includes book authors", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });
    await createMedia(db, { bookId: book.id, status: "ready" });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result[0]?.representative.book.authors).toHaveLength(1);
    expect(result[0]?.representative.book.authors[0]?.name).toBe("Jane Austen");
  });

  it("includes media narrators", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result[0]?.representative.narrators).toHaveLength(1);
    expect(result[0]?.representative.narrators[0]?.name).toBe("Rosamund Pike");
  });

  it("includes download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createDownload(db, {
      mediaId: media.id,
      status: "ready",
      thumbnails: {
        thumbhash: "downloadhash",
        extraSmall: "/xs.jpg",
        small: "/small.jpg",
        medium: "/medium.jpg",
        large: "/large.jpg",
        extraLarge: "/xl.jpg",
      },
    });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result[0]?.representative.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("only returns media with status 'ready'", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createMedia(db, { bookId: book.id, status: "ready" });
    await createMedia(db, { bookId: book.id, status: "pending" });
    await createMedia(db, { bookId: book.id, status: "error" });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result).toHaveLength(1);
  });

  it("returns media sorted by insertedAt descending", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-01-01"),
    });
    const newerMedia = await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-03-01"),
    });
    await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-02-01"),
    });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result[0]?.representative.id).toBe(newerMedia.id);
  });

  it("respects the limit parameter", async () => {
    const db = getDb();

    const book = await createBook(db);
    for (let i = 0; i < 5; i++) {
      await createMedia(db, {
        bookId: book.id,
        status: "ready",
        insertedAt: new Date(2024, 0, i + 1),
      });
    }

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 3);

    expect(result).toHaveLength(3);
  });

  it("supports pagination with insertedBefore", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-03-01T12:00:00Z"),
    });
    await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-02-01T12:00:00Z"),
    });
    await createMedia(db, {
      bookId: book.id,
      status: "ready",
      insertedAt: new Date("2024-01-01T12:00:00Z"),
    });

    const result = await getMediaPage(
      DEFAULT_TEST_SESSION,
      10,
      new Date("2024-02-15T00:00:00Z"),
    );

    expect(result).toHaveLength(2);
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      status: "ready",
    });

    const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

    expect(result).toEqual([]);
  });

  describe("sets", () => {
    async function createSet(
      db: ReturnType<typeof getDb>,
      partCount: number,
      { readyParts = partCount }: { readyParts?: number } = {},
    ) {
      const book = await createBook(db, { title: "The Way of Kings" });
      const set = await createRecordingGroup(db, {
        bookId: book.id,
        partsTotal: partCount,
      });
      const parts = [];
      for (let n = 1; n <= partCount; n++) {
        parts.push(
          await createMedia(db, {
            bookId: book.id,
            recordingGroupId: set.id,
            partNumber: n,
            status: n <= readyParts ? "ready" : "processing",
          }),
        );
      }
      return { book, set, parts };
    }

    it("collapses a set to one entry", async () => {
      const db = getDb();
      const { parts } = await createSet(db, 3);

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe("set");
      expect(result[0]?.representative.id).toBe(parts[0]!.id);
    });

    it("stacks the set's parts in part order, first part in front", async () => {
      const db = getDb();
      const { parts } = await createSet(db, 3);

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

      expect(result[0]?.media.map((m) => m.id)).toEqual(parts.map((p) => p.id));
    });

    it("represents a set by its first *ready* part", async () => {
      const db = getDb();
      const book = await createBook(db);
      const set = await createRecordingGroup(db, { bookId: book.id });
      await createMedia(db, {
        bookId: book.id,
        recordingGroupId: set.id,
        partNumber: 1,
        status: "processing",
      });
      const readyPart = await createMedia(db, {
        bookId: book.id,
        recordingGroupId: set.id,
        partNumber: 2,
      });

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.representative.id).toBe(readyPart.id);
    });

    it("presents a set with one ready part as a single recording", async () => {
      const db = getDb();
      const { parts } = await createSet(db, 3, { readyParts: 1 });

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe("single");
      expect(result[0]?.media.map((m) => m.id)).toEqual([parts[0]!.id]);
    });

    it("keeps a set and a standalone recording of the same book apart", async () => {
      const db = getDb();
      const { book } = await createSet(db, 2);
      const standalone = await createMedia(db, { bookId: book.id });

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 10);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.representative.id)).toContain(standalone.id);
    });

    it("fills a page with entries, not with parts", async () => {
      const db = getDb();
      await createSet(db, 3);
      await createSet(db, 3);
      await createSet(db, 3);

      const result = await getMediaPage(DEFAULT_TEST_SESSION, 2);

      expect(result).toHaveLength(2);
    });
  });
});

describe("getSearchedMedia", () => {
  it("returns empty array when no media matches search", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });

    const result = await getSearchedMedia(
      DEFAULT_TEST_SESSION,
      10,
      "nonexistent",
    );

    expect(result).toEqual([]);
  });

  it("finds media by book title", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Pride");

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.book.title).toBe("Pride and Prejudice");
  });

  it("finds media by author name", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Test Book" });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Austen");

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.book.authors[0]?.name).toBe("Jane Austen");
  });

  it("finds media by narrator name", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Test Book" });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Rosamund");

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.narrators[0]?.name).toBe("Rosamund Pike");
  });

  it("finds media by series name", async () => {
    const db = getDb();

    const series = await createSeries(db, { name: "Harry Potter" });
    const book = await createBook(db, { title: "Philosopher's Stone" });
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "J.K. Rowling" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Potter");

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.book.title).toBe("Philosopher's Stone");
  });

  it("returns distinct results for multiple matches", async () => {
    const db = getDb();

    // Create media that matches on both title and author
    const book = await createBook(db, { title: "Stephen King Book" });
    const media = await createMedia(db, { bookId: book.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Stephen King" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Not Stephen" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Stephen");

    // Should return only one result even though it matches on multiple fields
    expect(result).toHaveLength(1);
  });

  it("respects the limit parameter", async () => {
    const db = getDb();

    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, { title: `Test Book ${i}` });
      const media = await createMedia(db, { bookId: book.id, status: "ready" });
      await createBookAuthor(db, {
        bookId: book.id,
        author: { name: "Test Author" },
      });
      await createMediaNarrator(db, {
        mediaId: media.id,
        narrator: { name: "Test Narrator" },
      });
    }

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 3, "Test");

    expect(result).toHaveLength(3);
  });

  it("only returns media with status 'ready'", async () => {
    const db = getDb();

    const book1 = await createBook(db, { title: "Ready Book" });
    const media1 = await createMedia(db, { bookId: book1.id, status: "ready" });
    await createBookAuthor(db, {
      bookId: book1.id,
      author: { name: "Test Author" },
    });
    await createMediaNarrator(db, {
      mediaId: media1.id,
      narrator: { name: "Test Narrator" },
    });

    const book2 = await createBook(db, { title: "Pending Book" });
    const media2 = await createMedia(db, {
      bookId: book2.id,
      status: "pending",
    });
    await createBookAuthor(db, {
      bookId: book2.id,
      author: { name: "Test Author" },
    });
    await createMediaNarrator(db, {
      mediaId: media2.id,
      narrator: { name: "Test Narrator" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Book");

    expect(result).toHaveLength(1);
    expect(result[0]?.representative.book.title).toBe("Ready Book");
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, {
      url: "https://other-server.com",
      title: "Other Book",
    });
    const media = await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      status: "ready",
    });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: book.id,
      author: { url: "https://other-server.com", name: "Other Author" },
    });
    await createMediaNarrator(db, {
      url: "https://other-server.com",
      mediaId: media.id,
      narrator: { url: "https://other-server.com", name: "Other Narrator" },
    });

    const result = await getSearchedMedia(DEFAULT_TEST_SESSION, 10, "Other");

    expect(result).toEqual([]);
  });
});
