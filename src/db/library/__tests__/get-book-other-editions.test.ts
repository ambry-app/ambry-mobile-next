/**
 * Tests for getBookOtherEditions query function.
 */

import { getBookOtherEditions } from "@/db/library/get-book-other-editions";
import { MediaHeaderInfo } from "@/db/library/get-media-header-info";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createDownload,
  createMedia,
  createMediaNarrator,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

// Helper to create a minimal MediaHeaderInfo for testing
function makeMediaHeaderInfo(
  mediaId: string,
  bookId: string,
  bookTitle: string,
): MediaHeaderInfo {
  return {
    id: mediaId,
    fullCast: false,
    abridged: false,
    thumbnails: null,
    duration: "3600",
    description: null,
    published: null,
    publishedFormat: "full",
    publisher: null,
    notes: null,
    narrators: [],
    download: { thumbnails: null },
    book: {
      id: bookId,
      title: bookTitle,
      published: new Date(),
      publishedFormat: "full",
      authors: [],
      series: [],
    },
  };
}

describe("getBookOtherEditions", () => {
  it("returns null when no other editions exist", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result).toBeNull();
  });

  it("returns other editions of the same book", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });

    const mediaHeaderInfo = makeMediaHeaderInfo(media1.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result).not.toBeNull();
    expect(result?.media).toHaveLength(1);
    expect(result?.media[0]?.id).toBe(media2.id);
  });

  it("excludes the current media from results", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });
    const media3 = await createMedia(db, { bookId: book.id });

    const mediaHeaderInfo = makeMediaHeaderInfo(media1.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result?.media).toHaveLength(2);
    expect(result?.media.map((m) => m.id)).not.toContain(media1.id);
    expect(result?.media.map((m) => m.id)).toContain(media2.id);
    expect(result?.media.map((m) => m.id)).toContain(media3.id);
  });

  it("includes narrators for each edition", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media2.id,
      narrator: { name: "Rosamund Pike" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media1.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result?.media[0]?.narrators).toHaveLength(1);
    expect(result?.media[0]?.narrators[0]?.name).toBe("Rosamund Pike");
  });

  it("respects the limit parameter", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id });

    const mediaHeaderInfo = makeMediaHeaderInfo(media1.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      2,
    );

    expect(result?.media).toHaveLength(2);
  });

  it("includes download thumbnails when downloaded", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });
    await createDownload(db, {
      mediaId: media2.id,
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

    const mediaHeaderInfo = makeMediaHeaderInfo(media1.id, book.id, book.title);
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result?.media[0]?.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("only returns editions for the current session URL", async () => {
    const db = getDb();

    // Create book and media for other server
    const otherBook = await createBook(db, { url: "https://other-server.com" });
    const otherMedia1 = await createMedia(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
    });
    await createMedia(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
    });

    // Query with default session should not find other server's data
    const mediaHeaderInfo = makeMediaHeaderInfo(
      otherMedia1.id,
      otherBook.id,
      otherBook.title,
    );
    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
      10,
    );

    expect(result).toBeNull();
  });
});
