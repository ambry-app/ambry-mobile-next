/**
 * Tests for getOtherBooksByAuthors query function.
 */

import { MediaHeaderInfo } from "@/db/library/get-media-header-info";
import { getOtherBooksByAuthors } from "@/db/library/get-other-books-by-authors";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createAuthor,
  createBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  createPerson,
  createSeries,
  createSeriesBook,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

// Helper to create author info for makeBookInfo
function makeAuthorInfo(
  author: { id: string; name: string },
  person: { id: string; name: string },
) {
  return {
    id: author.id,
    name: author.name,
    person: { id: person.id, name: person.name },
  };
}

// Helper to create series info for makeBookInfo
function makeSeriesInfo(
  series: { id: string; name: string },
  bookNumber = "1",
) {
  return { id: series.id, bookNumber, name: series.name };
}

// Helper to create a minimal MediaHeaderInfo["book"] for testing
function makeBookInfo(
  bookId: string,
  authors: { id: string; name: string; person: { id: string; name: string } }[],
  series: { id: string; bookNumber: string; name: string }[] = [],
): MediaHeaderInfo["book"] {
  return {
    id: bookId,
    title: "Current Book",
    published: new Date(),
    publishedFormat: "full",
    authors,
    series,
  };
}

describe("getOtherBooksByAuthors", () => {
  it("returns empty array when book has no authors", async () => {
    const db = getDb();

    const book = await createBook(db);
    const bookInfo = makeBookInfo(book.id, []);

    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result).toEqual([]);
  });

  it("returns other books by the same author", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Brandon Sanderson" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Brandon Sanderson",
    });

    const currentBook = await createBook(db, { title: "Mistborn" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });

    const otherBook = await createBook(db, {
      title: "The Way of Kings",
      published: new Date("2010-08-31"),
    });
    await createBookAuthor(db, { bookId: otherBook.id, authorId: author.id });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Brandon Sanderson");
    expect(result[0]?.books).toHaveLength(1);
    expect(result[0]?.books[0]?.title).toBe("The Way of Kings");
  });

  it("excludes the current book from results", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Author" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Author",
    });

    const currentBook = await createBook(db, { title: "Current Book" });
    const otherBook = await createBook(db, { title: "Other Book" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });
    await createBookAuthor(db, { bookId: otherBook.id, authorId: author.id });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result[0]?.books).toHaveLength(1);
    expect(result[0]?.books[0]?.title).toBe("Other Book");
  });

  it("excludes books in the same series", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Author" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Author",
    });
    const series = await createSeries(db, { name: "Test Series" });

    // Current book in series
    const currentBook = await createBook(db, { title: "Book 1" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: currentBook.id,
      bookNumber: "1",
    });

    // Other book in same series (should be excluded)
    const bookInSeries = await createBook(db, { title: "Book 2" });
    await createBookAuthor(db, {
      bookId: bookInSeries.id,
      authorId: author.id,
    });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: bookInSeries.id,
      bookNumber: "2",
    });

    // Standalone book (should be included)
    const standaloneBook = await createBook(db, { title: "Standalone" });
    await createBookAuthor(db, {
      bookId: standaloneBook.id,
      authorId: author.id,
    });

    const bookInfo = makeBookInfo(
      currentBook.id,
      [makeAuthorInfo(author, person)],
      [makeSeriesInfo(series)],
    );
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result[0]?.books).toHaveLength(1);
    expect(result[0]?.books[0]?.title).toBe("Standalone");
  });

  it("includes co-authors for each book", async () => {
    const db = getDb();

    const person1 = await createPerson(db, { name: "Neil Gaiman" });
    const author1 = await createAuthor(db, {
      personId: person1.id,
      name: "Neil Gaiman",
    });
    const person2 = await createPerson(db, { name: "Terry Pratchett" });
    const author2 = await createAuthor(db, {
      personId: person2.id,
      name: "Terry Pratchett",
    });

    const currentBook = await createBook(db, { title: "Current Book" });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: author1.id,
    });

    const coauthoredBook = await createBook(db, { title: "Good Omens" });
    await createBookAuthor(db, {
      bookId: coauthoredBook.id,
      authorId: author1.id,
    });
    await createBookAuthor(db, {
      bookId: coauthoredBook.id,
      authorId: author2.id,
    });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author1, person1),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result[0]?.books[0]?.authors).toHaveLength(2);
  });

  it("includes media with narrators for each book", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Author" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Author",
    });

    const currentBook = await createBook(db, { title: "Current Book" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });

    const otherBook = await createBook(db, { title: "Other Book" });
    await createBookAuthor(db, { bookId: otherBook.id, authorId: author.id });
    const media = await createMedia(db, { bookId: otherBook.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result[0]?.books[0]?.media).toHaveLength(1);
    expect(result[0]?.books[0]?.media[0]?.narrators).toHaveLength(1);
    expect(result[0]?.books[0]?.media[0]?.narrators[0]?.name).toBe(
      "Stephen Fry",
    );
  });

  it("returns results for multiple authors", async () => {
    const db = getDb();

    const person1 = await createPerson(db, { name: "Author One" });
    const author1 = await createAuthor(db, {
      personId: person1.id,
      name: "Author One",
    });
    const person2 = await createPerson(db, { name: "Author Two" });
    const author2 = await createAuthor(db, {
      personId: person2.id,
      name: "Author Two",
    });

    const currentBook = await createBook(db, { title: "Co-authored Book" });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: author1.id,
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: author2.id,
    });

    const book1 = await createBook(db, { title: "Book by Author One" });
    await createBookAuthor(db, { bookId: book1.id, authorId: author1.id });

    const book2 = await createBook(db, { title: "Book by Author Two" });
    await createBookAuthor(db, { bookId: book2.id, authorId: author2.id });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author1, person1),
      makeAuthorInfo(author2, person2),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.books[0]?.title).toBe("Book by Author One");
    expect(result[1]?.books[0]?.title).toBe("Book by Author Two");
  });

  it("respects the books limit per author", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Author" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Author",
    });

    const currentBook = await createBook(db, { title: "Current Book" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });

    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, {
        title: `Other Book ${i}`,
        published: new Date(2020, i, 1),
      });
      await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    }

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      3,
    );

    expect(result[0]?.books).toHaveLength(3);
  });

  it("returns author with empty books array if no other books exist", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "One Book Author" });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "One Book Author",
    });

    const currentBook = await createBook(db, { title: "Only Book" });
    await createBookAuthor(db, { bookId: currentBook.id, authorId: author.id });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("One Book Author");
    expect(result[0]?.books).toEqual([]);
  });

  it("only returns books for the current session URL", async () => {
    const db = getDb();

    const person = await createPerson(db, { url: "https://other-server.com" });
    const author = await createAuthor(db, {
      url: "https://other-server.com",
      personId: person.id,
      name: "Author",
    });

    const currentBook = await createBook(db, {
      url: "https://other-server.com",
    });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: currentBook.id,
      authorId: author.id,
    });

    const otherBook = await createBook(db, { url: "https://other-server.com" });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
      authorId: author.id,
    });

    const bookInfo = makeBookInfo(currentBook.id, [
      makeAuthorInfo(author, person),
    ]);
    const result = await getOtherBooksByAuthors(
      DEFAULT_TEST_SESSION,
      bookInfo,
      10,
    );

    // Author is passed in, but books should be empty since they're from different URL
    expect(result[0]?.books).toEqual([]);
  });
});
