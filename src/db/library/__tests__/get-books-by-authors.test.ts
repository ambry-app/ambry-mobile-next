/**
 * Tests for getBooksByAuthors query function.
 */

import { getBooksByAuthors } from "@/db/library/get-books-by-authors";
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

describe("getBooksByAuthors", () => {
  it("returns empty array when given empty authors array", async () => {
    const result = await getBooksByAuthors(DEFAULT_TEST_SESSION, [], 10);

    expect(result).toEqual([]);
  });

  it("returns authors with their books", async () => {
    const db = getDb();

    const author = await createAuthor(db, { name: "Brandon Sanderson" });
    const book1 = await createBook(db, {
      title: "Mistborn",
      published: new Date("2006-07-17"),
    });
    const book2 = await createBook(db, {
      title: "The Way of Kings",
      published: new Date("2010-08-31"),
    });
    await createBookAuthor(db, { bookId: book1.id, authorId: author.id });
    await createBookAuthor(db, { bookId: book2.id, authorId: author.id });

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Brandon Sanderson");
    expect(result[0]?.books).toHaveLength(2);
    // Sorted by published date descending
    expect(result[0]?.books[0]?.title).toBe("The Way of Kings");
    expect(result[0]?.books[1]?.title).toBe("Mistborn");
  });

  it("returns multiple authors with their respective books", async () => {
    const db = getDb();

    const author1 = await createAuthor(db, { name: "Author One" });
    const author2 = await createAuthor(db, { name: "Author Two" });
    const book1 = await createBook(db, { title: "Book by Author One" });
    const book2 = await createBook(db, { title: "Book by Author Two" });
    await createBookAuthor(db, { bookId: book1.id, authorId: author1.id });
    await createBookAuthor(db, { bookId: book2.id, authorId: author2.id });

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [
        { id: author1.id, name: author1.name },
        { id: author2.id, name: author2.name },
      ],
      10,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.books[0]?.title).toBe("Book by Author One");
    expect(result[1]?.books[0]?.title).toBe("Book by Author Two");
  });

  it("includes co-authors for each book", async () => {
    const db = getDb();

    const author1 = await createAuthor(db, { name: "Neil Gaiman" });
    const author2 = await createAuthor(db, { name: "Terry Pratchett" });
    const book = await createBook(db, { title: "Good Omens" });
    await createBookAuthor(db, { bookId: book.id, authorId: author1.id });
    await createBookAuthor(db, { bookId: book.id, authorId: author2.id });

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author1.id, name: author1.name }],
      10,
    );

    expect(result[0]?.books[0]?.authors).toHaveLength(2);
  });

  it("includes media with narrators for each book", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    const book = await createBook(db);
    await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator Name" },
    });

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      10,
    );

    expect(result[0]?.books[0]?.media).toHaveLength(1);
    expect(result[0]?.books[0]?.media[0]?.narrators).toHaveLength(1);
    expect(result[0]?.books[0]?.media[0]?.narrators[0]?.name).toBe(
      "Narrator Name",
    );
  });

  it("includes media with empty narrators array if media has no narrators", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    const book = await createBook(db);
    await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    await createMedia(db, { bookId: book.id }); // No narrators created

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      10,
    );

    expect(result[0]?.books[0]?.media).toHaveLength(1);
    expect(result[0]?.books[0]?.media[0]?.narrators).toEqual([]);
  });

  it("respects the books limit per author", async () => {
    const db = getDb();

    const author = await createAuthor(db);
    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, {
        title: `Book ${i}`,
        published: new Date(2020, i, 1),
      });
      await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    }

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      3,
    );

    expect(result[0]?.books).toHaveLength(3);
  });

  it("returns author with empty books array if author has no books", async () => {
    const db = getDb();

    const author = await createAuthor(db, { name: "No Books Author" });

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("No Books Author");
    expect(result[0]?.books).toEqual([]);
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

    const result = await getBooksByAuthors(
      DEFAULT_TEST_SESSION,
      [{ id: author.id, name: author.name }],
      10,
    );

    // Author is passed in, but books should be empty since they're from different URL
    expect(result[0]?.books).toEqual([]);
  });
});
