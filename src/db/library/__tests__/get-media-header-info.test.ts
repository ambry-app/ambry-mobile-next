/**
 * Tests for getMediaHeaderInfo query function.
 */

import { getMediaHeaderInfo } from "@/db/library/get-media-header-info";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  createSeries,
  createSeriesBook,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getMediaHeaderInfo", () => {
  it("throws error when media not found", async () => {
    await expect(
      getMediaHeaderInfo(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("Media not found");
  });

  it("returns media with basic info", async () => {
    const db = getDb();

    const media = await createMedia(db, {
      duration: "3600",
      description: "A great audiobook",
      publisher: "Penguin",
    });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.id).toBe(media.id);
    expect(result.duration).toBe("3600");
    expect(result.description).toBe("A great audiobook");
    expect(result.publisher).toBe("Penguin");
  });

  it("returns media with book info", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, { bookId: book.id });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.book.id).toBe(book.id);
    expect(result.book.title).toBe("Pride and Prejudice");
  });

  it("returns media with narrators and their person info", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.narrators).toHaveLength(1);
    expect(result.narrators[0]?.name).toBe("Rosamund Pike");
    expect(result.narrators[0]?.person).toBeDefined();
  });

  it("returns media with authors and their person info", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createBookAuthor(db, {
      bookId: media.bookId,
      author: { name: "Jane Austen" },
    });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.book.authors).toHaveLength(1);
    expect(result.book.authors[0]?.name).toBe("Jane Austen");
    expect(result.book.authors[0]?.person).toBeDefined();
  });

  it("returns media with series info", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    const series = await createSeries(db, { name: "The Classics Collection" });
    await createSeriesBook(db, {
      seriesId: series.id,
      bookId: book.id,
      bookNumber: "1",
    });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.book.series).toHaveLength(1);
    expect(result.book.series[0]?.name).toBe("The Classics Collection");
    expect(result.book.series[0]?.bookNumber).toBe("1");
  });

  it("returns media in multiple series", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    const series1 = await createSeries(db, { name: "Series One" });
    const series2 = await createSeries(db, { name: "Series Two" });
    await createSeriesBook(db, {
      seriesId: series1.id,
      bookId: book.id,
      bookNumber: "1",
    });
    await createSeriesBook(db, {
      seriesId: series2.id,
      bookId: book.id,
      bookNumber: "5",
    });

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.book.series).toHaveLength(2);
    expect(result.book.series.map((s) => s.name)).toContain("Series One");
    expect(result.book.series.map((s) => s.name)).toContain("Series Two");
  });

  it("returns download thumbnails when downloaded", async () => {
    const db = getDb();

    const media = await createMedia(db);
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

    const result = await getMediaHeaderInfo(DEFAULT_TEST_SESSION, media.id);

    expect(result.download?.thumbnails?.thumbhash).toBe("downloadhash");
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      id: "media-other-server",
    });

    await expect(
      getMediaHeaderInfo(DEFAULT_TEST_SESSION, "media-other-server"),
    ).rejects.toThrow("Media not found");
  });
});
