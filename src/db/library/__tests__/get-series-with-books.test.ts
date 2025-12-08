/**
 * Tests for getSeriesWithBooks query function.
 */

import { getSeriesWithBooks } from "@/db/library/get-series-with-books";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  createSeries,
  createSeriesBook,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getSeriesWithBooks", () => {
  it("returns empty array when given empty series array", async () => {
    const result = await getSeriesWithBooks(DEFAULT_TEST_SESSION, [], 10);

    expect(result).toEqual([]);
  });

  it("returns series with their books", async () => {
    const db = getDb();

    const series = await createSeries(db, { name: "Harry Potter" });
    const book1 = await createBook(db, { title: "Philosopher's Stone" });
    const book2 = await createBook(db, { title: "Chamber of Secrets" });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book1.id,
      bookNumber: "1",
    });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book2.id,
      bookNumber: "2",
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Harry Potter");
    expect(result[0]?.seriesBooks).toHaveLength(2);
    // Sorted by book number
    expect(result[0]?.seriesBooks[0]?.book.title).toBe("Philosopher's Stone");
    expect(result[0]?.seriesBooks[1]?.book.title).toBe("Chamber of Secrets");
  });

  it("returns multiple series with their respective books", async () => {
    const db = getDb();

    const series1 = await createSeries(db, { name: "Series One" });
    const series2 = await createSeries(db, { name: "Series Two" });
    const book1 = await createBook(db, { title: "Book in Series One" });
    const book2 = await createBook(db, { title: "Book in Series Two" });
    await createSeriesBook(db, { seriesId: series1.id, bookId: book1.id });
    await createSeriesBook(db, { seriesId: series2.id, bookId: book2.id });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [
        { id: series1.id, name: series1.name },
        { id: series2.id, name: series2.name },
      ],
      10,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.seriesBooks[0]?.book.title).toBe("Book in Series One");
    expect(result[1]?.seriesBooks[0]?.book.title).toBe("Book in Series Two");
  });

  it("includes book number for each series book", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book.id,
      bookNumber: "2.5",
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    expect(result[0]?.seriesBooks[0]?.bookNumber).toBe("2.5");
  });

  it("includes authors for each book", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Test Author" },
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    expect(result[0]?.seriesBooks[0]?.book.authors).toHaveLength(1);
    expect(result[0]?.seriesBooks[0]?.book.authors[0]?.name).toBe(
      "Test Author",
    );
  });

  it("includes media with narrators for each book", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Test Narrator" },
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    expect(result[0]?.seriesBooks[0]?.book.media).toHaveLength(1);
    expect(result[0]?.seriesBooks[0]?.book.media[0]?.narrators).toHaveLength(1);
    expect(result[0]?.seriesBooks[0]?.book.media[0]?.narrators[0]?.name).toBe(
      "Test Narrator",
    );
  });

  it("sorts books by book number numerically", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book1 = await createBook(db, { title: "Book 1" });
    const book2 = await createBook(db, { title: "Book 2" });
    const book10 = await createBook(db, { title: "Book 10" });
    // Insert out of order
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book10.id,
      bookNumber: "10",
    });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book1.id,
      bookNumber: "1",
    });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book2.id,
      bookNumber: "2",
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    // Should be sorted 1, 2, 10 (numerically)
    expect(result[0]?.seriesBooks.map((sb) => sb.bookNumber)).toEqual([
      "1",
      "2",
      "10",
    ]);
  });

  it("respects the books limit per series", async () => {
    const db = getDb();

    const series = await createSeries(db);
    for (let i = 1; i <= 5; i++) {
      const book = await createBook(db, { title: `Book ${i}` });
      await createSeriesBook(db, {
        seriesId: series.id,
        bookId: book.id,
        bookNumber: String(i),
      });
    }

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      3,
    );

    expect(result[0]?.seriesBooks).toHaveLength(3);
  });

  it("returns series with empty seriesBooks array if series has no books", async () => {
    const db = getDb();

    const series = await createSeries(db, { name: "Empty Series" });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Empty Series");
    expect(result[0]?.seriesBooks).toEqual([]);
  });

  it("only returns books for the current session URL", async () => {
    const db = getDb();

    const series = await createSeries(db, { url: "https://other-server.com" });
    const book = await createBook(db, { url: "https://other-server.com" });
    await createSeriesBook(db, {
      url: "https://other-server.com",
      seriesId: series.id,
      bookId: book.id,
    });

    const result = await getSeriesWithBooks(
      DEFAULT_TEST_SESSION,
      [{ id: series.id, name: series.name }],
      10,
    );

    // Series is passed in, but books should be empty since they're from different URL
    expect(result[0]?.seriesBooks).toEqual([]);
  });
});
