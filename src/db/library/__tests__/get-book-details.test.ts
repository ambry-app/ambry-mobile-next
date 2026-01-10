/**
 * Tests for getBookDetails query function.
 */

import { getBookDetails } from "@/db/library/get-book-details";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getBookDetails", () => {
  it("throws error when book not found", async () => {
    await expect(
      getBookDetails(DEFAULT_TEST_SESSION, "nonexistent-id", 10),
    ).rejects.toThrow("Book not found");
  });

  it("returns book with basic info", async () => {
    const db = getDb();

    const book = await createBook(db, {
      title: "The Great Gatsby",
      published: new Date("1925-04-10"),
      publishedFormat: "full",
    });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.id).toBe(book.id);
    expect(result.title).toBe("The Great Gatsby");
    expect(result.publishedFormat).toBe("full");
  });

  it("returns book with authors", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "1984" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "George Orwell" },
    });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.authors).toHaveLength(1);
    expect(result.authors[0]?.name).toBe("George Orwell");
  });

  it("returns book with multiple authors in insertion order", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author One" },
    });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author Two" },
    });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.authors).toHaveLength(2);
    expect(result.authors[0]?.name).toBe("Author One");
    expect(result.authors[1]?.name).toBe("Author Two");
  });

  it("returns book with media", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.media).toHaveLength(1);
    expect(result.media[0]?.id).toBe(media.id);
  });

  it("returns media with narrators", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.media[0]?.narrators).toHaveLength(1);
    expect(result.media[0]?.narrators[0]?.name).toBe("Stephen Fry");
  });

  it("respects media limit", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id });

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 2);

    expect(result.media).toHaveLength(2);
  });

  it("includes download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
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

    const result = await getBookDetails(DEFAULT_TEST_SESSION, book.id, 10);

    expect(result.media[0]?.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("only returns book for the current session URL", async () => {
    const db = getDb();

    await createBook(db, {
      url: "https://other-server.com",
      id: "book-other-server",
      title: "Other Book",
    });

    await expect(
      getBookDetails(DEFAULT_TEST_SESSION, "book-other-server", 10),
    ).rejects.toThrow("Book not found");
  });
});
