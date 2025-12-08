/**
 * Tests for getSeriesBooksPage query function.
 */

import { getSeriesBooksPage } from "@/db/library/get-series-books-page";
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

describe("getSeriesBooksPage", () => {
  it("returns empty array when series has no books", async () => {
    const db = getDb();

    const series = await createSeries(db);

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    expect(result).toEqual([]);
  });

  it("returns books in a series with book numbers", async () => {
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

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.bookNumber).toBe("1");
    expect(result[0]?.book.title).toBe("Philosopher's Stone");
    expect(result[1]?.bookNumber).toBe("2");
    expect(result[1]?.book.title).toBe("Chamber of Secrets");
  });

  it("returns books sorted by book number numerically", async () => {
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

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    // Should be sorted 1, 2, 10 (numerically, not alphabetically)
    expect(result.map((sb) => sb.bookNumber)).toEqual(["1", "2", "10"]);
  });

  it("respects the limit parameter", async () => {
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

    const result = await getSeriesBooksPage(DEFAULT_TEST_SESSION, series.id, 3);

    expect(result).toHaveLength(3);
    expect(result.map((sb) => sb.bookNumber)).toEqual(["1", "2", "3"]);
  });

  it("supports pagination with bookNumberAfter", async () => {
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

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
      "2",
    );

    // Should return books with number > 2
    expect(result).toHaveLength(3);
    expect(result.map((sb) => sb.bookNumber)).toEqual(["3", "4", "5"]);
  });

  it("returns books with authors", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book.id,
      bookNumber: "1",
    });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "J.K. Rowling" },
    });

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    expect(result[0]?.book.authors).toHaveLength(1);
    expect(result[0]?.book.authors[0]?.name).toBe("J.K. Rowling");
  });

  it("returns books with media and narrators", async () => {
    const db = getDb();

    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book.id,
      bookNumber: "1",
    });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    expect(result[0]?.book.media).toHaveLength(1);
    expect(result[0]?.book.media[0]?.id).toBe(media.id);
    expect(result[0]?.book.media[0]?.narrators).toHaveLength(1);
    expect(result[0]?.book.media[0]?.narrators[0]?.name).toBe("Stephen Fry");
  });

  it("only returns books for the current session URL", async () => {
    const db = getDb();

    const series = await createSeries(db, { url: "https://other-server.com" });
    const book = await createBook(db, { url: "https://other-server.com" });
    await createSeriesBook(db, {
      url: "https://other-server.com",
      seriesId: series.id,
      bookId: book.id,
      bookNumber: "1",
    });

    const result = await getSeriesBooksPage(
      DEFAULT_TEST_SESSION,
      series.id,
      10,
    );

    expect(result).toEqual([]);
  });
});
