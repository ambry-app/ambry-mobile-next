/**
 * Tests for getMediaByNarrators query function.
 */

import { getMediaByNarrators } from "@/db/library/get-media-by-narrators";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  createNarrator,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getMediaByNarrators", () => {
  it("returns empty array when given empty narrators array", async () => {
    const result = await getMediaByNarrators(DEFAULT_TEST_SESSION, [], 10);

    expect(result).toEqual([]);
  });

  it("returns narrators with their media", async () => {
    const db = getDb();

    const narrator = await createNarrator(db, { name: "Stephen Fry" });
    const book1 = await createBook(db, {
      title: "Harry Potter 1",
      published: new Date("2000-01-01"),
    });
    const book2 = await createBook(db, {
      title: "Harry Potter 2",
      published: new Date("2001-01-01"),
    });
    const media1 = await createMedia(db, { bookId: book1.id });
    const media2 = await createMedia(db, { bookId: book2.id });
    await createMediaNarrator(db, {
      mediaId: media1.id,
      narratorId: narrator.id,
    });
    await createMediaNarrator(db, {
      mediaId: media2.id,
      narratorId: narrator.id,
    });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Stephen Fry");
    expect(result[0]?.media).toHaveLength(2);
    // Sorted by published date descending
    expect(result[0]?.media[0]?.book.title).toBe("Harry Potter 2");
    expect(result[0]?.media[1]?.book.title).toBe("Harry Potter 1");
  });

  it("returns multiple narrators with their respective media", async () => {
    const db = getDb();

    const narrator1 = await createNarrator(db, { name: "Narrator One" });
    const narrator2 = await createNarrator(db, { name: "Narrator Two" });
    const book1 = await createBook(db, { title: "Book One" });
    const book2 = await createBook(db, { title: "Book Two" });
    const media1 = await createMedia(db, { bookId: book1.id });
    const media2 = await createMedia(db, { bookId: book2.id });
    await createMediaNarrator(db, {
      mediaId: media1.id,
      narratorId: narrator1.id,
    });
    await createMediaNarrator(db, {
      mediaId: media2.id,
      narratorId: narrator2.id,
    });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [
        { id: narrator1.id, name: narrator1.name },
        { id: narrator2.id, name: narrator2.name },
      ],
      10,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.media[0]?.book.title).toBe("Book One");
    expect(result[1]?.media[0]?.book.title).toBe("Book Two");
  });

  it("includes book with authors for each media", async () => {
    const db = getDb();

    const narrator = await createNarrator(db);
    const book = await createBook(db, { title: "Test Book" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Test Author" },
    });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narratorId: narrator.id,
    });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      10,
    );

    expect(result[0]?.media[0]?.book.title).toBe("Test Book");
    expect(result[0]?.media[0]?.book.authors).toHaveLength(1);
    expect(result[0]?.media[0]?.book.authors[0]?.name).toBe("Test Author");
  });

  it("includes all narrators for each media", async () => {
    const db = getDb();

    const narrator1 = await createNarrator(db, { name: "Narrator One" });
    const narrator2 = await createNarrator(db, { name: "Narrator Two" });
    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narratorId: narrator1.id,
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narratorId: narrator2.id,
    });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator1.id, name: narrator1.name }],
      10,
    );

    expect(result[0]?.media[0]?.narrators).toHaveLength(2);
  });

  it("includes download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const narrator = await createNarrator(db);
    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narratorId: narrator.id,
    });
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

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      10,
    );

    expect(result[0]?.media[0]?.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("respects the media limit per narrator", async () => {
    const db = getDb();

    const narrator = await createNarrator(db);
    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, { published: new Date(2020, i, 1) });
      const media = await createMedia(db, { bookId: book.id });
      await createMediaNarrator(db, {
        mediaId: media.id,
        narratorId: narrator.id,
      });
    }

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      3,
    );

    expect(result[0]?.media).toHaveLength(3);
  });

  it("returns narrator with empty media array if narrator has no media", async () => {
    const db = getDb();

    const narrator = await createNarrator(db, { name: "No Media Narrator" });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("No Media Narrator");
    expect(result[0]?.media).toEqual([]);
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const narrator = await createNarrator(db, {
      url: "https://other-server.com",
    });
    const book = await createBook(db, { url: "https://other-server.com" });
    const media = await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
    });
    await createMediaNarrator(db, {
      url: "https://other-server.com",
      mediaId: media.id,
      narratorId: narrator.id,
    });

    const result = await getMediaByNarrators(
      DEFAULT_TEST_SESSION,
      [{ id: narrator.id, name: narrator.name }],
      10,
    );

    // Narrator is passed in, but media should be empty since it's from different URL
    expect(result[0]?.media).toEqual([]);
  });
});
