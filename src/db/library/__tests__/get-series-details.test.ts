/**
 * Tests for getSeriesDetails query function.
 */

import { getSeriesDetails } from "@/db/library/get-series-details";
import { setupTestDatabase } from "@test/db-test-utils";
import {
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

describe("getSeriesDetails", () => {
  it("throws error when series not found", async () => {
    await expect(
      getSeriesDetails(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("not found");
  });

  it("returns series with basic info", async () => {
    const db = getDb();

    const series = await createSeries(db, { name: "The Lord of the Rings" });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.id).toBe(series.id);
    expect(result.name).toBe("The Lord of the Rings");
  });

  it("returns series with authors from books", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "J.R.R. Tolkien" });
    const series = await createSeries(db, { name: "The Lord of the Rings" });
    const book = await createBook(db, { title: "The Fellowship of the Ring" });
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "J.R.R. Tolkien" },
    });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.authorsAndNarrators).toHaveLength(1);
    expect(result.authorsAndNarrators[0]?.type).toBe("author");
    expect(result.authorsAndNarrators[0]?.realName).toBe("J.R.R. Tolkien");
  });

  it("returns series with narrators from media", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Rob Inglis" });
    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { personId: person.id, name: "Rob Inglis" },
    });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.authorsAndNarrators).toHaveLength(1);
    expect(result.authorsAndNarrators[0]?.type).toBe("narrator");
    expect(result.authorsAndNarrators[0]?.realName).toBe("Rob Inglis");
  });

  it("combines author and narrator when same person", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Neil Gaiman" });
    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Neil Gaiman" },
    });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { personId: person.id, name: "Neil Gaiman" },
    });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.authorsAndNarrators).toHaveLength(1);
    expect(result.authorsAndNarrators[0]?.type).toBe("authorAndNarrator");
    expect(result.authorsAndNarrators[0]?.realName).toBe("Neil Gaiman");
  });

  it("returns distinct authors across multiple books in series", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Brandon Sanderson" });
    const series = await createSeries(db, { name: "Mistborn" });
    const book1 = await createBook(db, { title: "The Final Empire" });
    const book2 = await createBook(db, { title: "The Well of Ascension" });
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
    // Same author for both books
    await createBookAuthor(db, {
      bookId: book1.id,
      author: { personId: person.id, name: "Brandon Sanderson" },
    });
    await createBookAuthor(db, {
      bookId: book2.id,
      author: { personId: person.id, name: "Brandon Sanderson" },
    });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    // Should only return the author once (distinct)
    const authors = result.authorsAndNarrators.filter(
      (an) => an.type === "author" || an.type === "authorAndNarrator",
    );
    expect(authors).toHaveLength(1);
  });

  it("returns empty authorsAndNarrators when series has no books", async () => {
    const db = getDb();

    const series = await createSeries(db, { name: "Empty Series" });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.authorsAndNarrators).toEqual([]);
  });

  it("includes person thumbnails", async () => {
    const db = getDb();

    const person = await createPerson(db, {
      name: "Famous Author",
      thumbnails: {
        thumbhash: "abc",
        extraSmall: "/xs.jpg",
        small: "/small.jpg",
        medium: "/medium.jpg",
        large: "/large.jpg",
        extraLarge: "/xl.jpg",
      },
    });
    const series = await createSeries(db);
    const book = await createBook(db);
    await createSeriesBook(db, { seriesId: series.id, bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Famous Author" },
    });

    const result = await getSeriesDetails(DEFAULT_TEST_SESSION, series.id);

    expect(result.authorsAndNarrators[0]?.thumbnails?.thumbhash).toBe("abc");
  });

  it("only returns series for the current session URL", async () => {
    const db = getDb();

    await createSeries(db, {
      url: "https://other-server.com",
      id: "series-other-server",
      name: "Other Series",
    });

    await expect(
      getSeriesDetails(DEFAULT_TEST_SESSION, "series-other-server"),
    ).rejects.toThrow("not found");
  });
});
