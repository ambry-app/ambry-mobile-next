/**
 * Tests for getBooksByAuthorPage query function.
 */

import { getBooksByAuthorPage } from "@/db/library/get-books-by-author-page";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createAuthor,
  createBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getBooksByAuthorPage", () => {
  it("returns empty array when author has no books", async () => {
    const db = getDb();

    const author = await createAuthor(db);

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      10,
    );

    expect(result).toEqual([]);
  });

  it("returns books by an author", async () => {
    const db = getDb();

    const author = await createAuthor(db, { name: "Jane Austen" });
    const book1 = await createBook(db, {
      title: "Pride and Prejudice",
      published: new Date("1813-01-28"),
    });
    const book2 = await createBook(db, {
      title: "Sense and Sensibility",
      published: new Date("1811-10-30"),
    });
    await createBookAuthor(db, { bookId: book1.id, authorId: author.id });
    await createBookAuthor(db, { bookId: book2.id, authorId: author.id });

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      10,
    );

    expect(result).toHaveLength(2);
    // Sorted by published date descending
    expect(result[0]?.title).toBe("Pride and Prejudice");
    expect(result[1]?.title).toBe("Sense and Sensibility");
  });

  it("includes authors for each book", async () => {
    const db = getDb();

    const author1 = await createAuthor(db, { name: "Neil Gaiman" });
    const author2 = await createAuthor(db, { name: "Terry Pratchett" });
    const book = await createBook(db, { title: "Good Omens" });
    await createBookAuthor(db, { bookId: book.id, authorId: author1.id });
    await createBookAuthor(db, { bookId: book.id, authorId: author2.id });

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author1.id,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.authors).toHaveLength(2);
  });

  it("includes media with narrators for each book", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    const book = await createBook(db);
    await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      10,
    );

    expect(result[0]?.media).toHaveLength(1);
    expect(result[0]?.media[0]?.narrators).toHaveLength(1);
    expect(result[0]?.media[0]?.narrators[0]?.name).toBe("Stephen Fry");
  });

  it("respects the limit parameter", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, {
        title: `Book ${i}`,
        published: new Date(2020, i, 1),
      });
      await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    }

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      3,
    );

    expect(result).toHaveLength(3);
  });

  it("supports pagination with publishedBefore", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    // Use dates with time to ensure clear separation
    const dates = [
      new Date("2023-06-15T12:00:00Z"),
      new Date("2022-06-15T12:00:00Z"),
      new Date("2021-06-15T12:00:00Z"),
      new Date("2020-06-15T12:00:00Z"),
    ];
    for (const date of dates) {
      const book = await createBook(db, { published: date });
      await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    }

    // Get books published before 2022-01-01 (should get 2021 and 2020 books)
    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      10,
      new Date("2022-01-01T00:00:00Z"),
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.published?.getFullYear()).toBe(2021);
    expect(result[1]?.published?.getFullYear()).toBe(2020);
  });

  it("only returns books for the current session URL", async () => {
    const db = getDb();

    const author = await createAuthor(db, { url: "https://other-server.com" });
    const book = await createBook(db, { url: "https://other-server.com" });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: book.id,
      authorId: author.id,
    });

    const result = await getBooksByAuthorPage(
      DEFAULT_TEST_SESSION,
      author.id,
      10,
    );

    expect(result).toEqual([]);
  });
});
