/**
 * Tests for getPlaythroughsPage query function.
 */

import { getPlaythroughsPage } from "@/db/library/get-playthroughs-page";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  createPlaythrough,
  createPlaythroughStateCache,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getPlaythroughsPage", () => {
  it("returns empty array when no playthroughs exist", async () => {
    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result).toEqual([]);
  });

  it("returns playthroughs with the specified status", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Test Book" });
    const media = await createMedia(db, { bookId: book.id, duration: "3600" });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });
    await createPlaythrough(db, { mediaId: media.id, status: "finished" });

    const inProgress = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );
    const finished = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "finished",
    );

    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.status).toBe("in_progress");
    expect(finished).toHaveLength(1);
    expect(finished[0]?.status).toBe("finished");
  });

  it("returns playthrough with media and book info", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, { bookId: book.id, duration: "36000" });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.media.id).toBe(media.id);
    expect(result[0]?.media.duration).toBe("36000");
    expect(result[0]?.media.book.title).toBe("Pride and Prejudice");
  });

  it("includes book authors", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });
    const media = await createMedia(db, { bookId: book.id });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.media.book.authors).toHaveLength(1);
    expect(result[0]?.media.book.authors[0]?.name).toBe("Jane Austen");
  });

  it("includes media narrators", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.media.narrators).toHaveLength(1);
    expect(result[0]?.media.narrators[0]?.name).toBe("Rosamund Pike");
  });

  it("includes playthrough state from cache", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
      currentPosition: 1234,
      currentRate: 1.5,
      lastEventAt: new Date("2024-01-15T10:30:00Z"),
    });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.position).toBe(1234);
    expect(result[0]?.playbackRate).toBe(1.5);
    expect(result[0]?.lastListenedAt).toEqual(new Date("2024-01-15T10:30:00Z"));
  });

  it("defaults position and playbackRate when no cache exists", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.position).toBe(0);
    expect(result[0]?.playbackRate).toBe(1);
    expect(result[0]?.lastListenedAt).toBeNull();
  });

  it("includes download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });
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

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result[0]?.media.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("respects the limit parameter", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    for (let i = 0; i < 5; i++) {
      await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
        updatedAt: new Date(2024, 0, i + 1),
      });
    }

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      3,
      "in_progress",
    );

    expect(result).toHaveLength(3);
  });

  it("returns in_progress playthroughs sorted by lastEventAt descending", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    // Create playthroughs with state caches that have different lastEventAt values
    const pt1 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt1.id,
      lastEventAt: new Date("2024-01-01"),
    });

    const pt2 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt2.id,
      lastEventAt: new Date("2024-03-01"),
    });

    const pt3 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt3.id,
      lastEventAt: new Date("2024-02-01"),
    });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    // Should be sorted by lastEventAt (from state cache), not updatedAt
    expect(result[0]?.lastListenedAt).toEqual(new Date("2024-03-01"));
    expect(result[1]?.lastListenedAt).toEqual(new Date("2024-02-01"));
    expect(result[2]?.lastListenedAt).toEqual(new Date("2024-01-01"));
  });

  it("supports pagination with cursorBefore for in_progress", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    // Create playthroughs with state caches
    const pt1 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt1.id,
      lastEventAt: new Date("2024-03-01"),
    });

    const pt2 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt2.id,
      lastEventAt: new Date("2024-02-01"),
    });

    const pt3 = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: pt3.id,
      lastEventAt: new Date("2024-01-01"),
    });

    // Paginate using lastEventAt cursor (for in_progress status)
    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
      null,
      new Date("2024-02-15"), // cursor before Feb 15 should return Feb 1 and Jan 1
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.lastListenedAt).toEqual(new Date("2024-02-01"));
    expect(result[1]?.lastListenedAt).toEqual(new Date("2024-01-01"));
  });

  it("excludes specific media with withoutMediaId", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });
    await createPlaythrough(db, { mediaId: media1.id, status: "in_progress" });
    await createPlaythrough(db, { mediaId: media2.id, status: "in_progress" });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
      media1.id,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.media.id).toBe(media2.id);
  });

  it("excludes deleted playthroughs", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createPlaythrough(db, { mediaId: media.id, status: "in_progress" });
    await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
      deletedAt: new Date(),
    });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result).toHaveLength(1);
  });

  it("only returns playthroughs for the current session", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    const media = await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
    });
    await createPlaythrough(db, {
      url: "https://other-server.com",
      mediaId: media.id,
      status: "in_progress",
    });

    const result = await getPlaythroughsPage(
      DEFAULT_TEST_SESSION,
      10,
      "in_progress",
    );

    expect(result).toEqual([]);
  });
});
