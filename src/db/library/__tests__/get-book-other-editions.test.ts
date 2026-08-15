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
  createRecordingGroup,
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
    title: null,
    partNumber: null,
    set: null,
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
    expect(result?.editions).toHaveLength(1);
    expect(result?.editions[0]?.representative.id).toBe(media2.id);
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

    const editionIds = result?.editions.map((e) => e.representative.id);
    expect(result?.editions).toHaveLength(2);
    expect(editionIds).not.toContain(media1.id);
    expect(editionIds).toContain(media2.id);
    expect(editionIds).toContain(media3.id);
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

    expect(result?.editions[0]?.representative.narrators).toHaveLength(1);
    expect(result?.editions[0]?.representative.narrators[0]?.name).toBe(
      "Rosamund Pike",
    );
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

    expect(result?.editions).toHaveLength(2);
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

    expect(
      result?.editions[0]?.representative.download?.thumbnails?.thumbhash,
    ).toBe("downloadhash");
  });

  describe("when the reader is on a part of a set", () => {
    it("leaves out the rest of the reader's own set", async () => {
      const db = getDb();

      const book = await createBook(db);
      const set = await createRecordingGroup(db, {
        bookId: book.id,
        partsTotal: 3,
      });
      const parts = [];
      for (let n = 1; n <= 3; n++) {
        parts.push(
          await createMedia(db, {
            bookId: book.id,
            recordingGroupId: set.id,
            partNumber: n,
          }),
        );
      }
      const otherEdition = await createMedia(db, { bookId: book.id });

      const result = await getBookOtherEditions(
        DEFAULT_TEST_SESSION,
        { ...makeMediaHeaderInfo(parts[0]!.id, book.id, book.title), set },
        10,
      );

      expect(result?.editions).toHaveLength(1);
      expect(result?.editions[0]?.representative.id).toBe(otherEdition.id);
    });

    it("leaves out a lone sibling rather than calling it an edition", async () => {
      // the trap: with one part left over, dropping only the current recording
      // leaves a one-part set, which collapses to a single edition and
      // presents itself as a rival edition of the book
      const db = getDb();

      const book = await createBook(db);
      const set = await createRecordingGroup(db, {
        bookId: book.id,
        partsTotal: 2,
      });
      const part1 = await createMedia(db, {
        bookId: book.id,
        recordingGroupId: set.id,
        partNumber: 1,
      });
      await createMedia(db, {
        bookId: book.id,
        recordingGroupId: set.id,
        partNumber: 2,
      });

      const result = await getBookOtherEditions(
        DEFAULT_TEST_SESSION,
        { ...makeMediaHeaderInfo(part1.id, book.id, book.title), set },
        10,
      );

      expect(result).toBeNull();
    });

    it("collapses a rival set into one stacked edition", async () => {
      const db = getDb();

      const book = await createBook(db);
      const rival = await createRecordingGroup(db, {
        bookId: book.id,
        partsTotal: 3,
      });
      const rivalParts = [];
      for (let n = 1; n <= 3; n++) {
        rivalParts.push(
          await createMedia(db, {
            bookId: book.id,
            recordingGroupId: rival.id,
            partNumber: n,
          }),
        );
      }
      const current = await createMedia(db, { bookId: book.id });

      const result = await getBookOtherEditions(
        DEFAULT_TEST_SESSION,
        makeMediaHeaderInfo(current.id, book.id, book.title),
        10,
      );

      expect(result?.editions).toHaveLength(1);
      expect(result?.editions[0]?.kind).toBe("set");
      expect(result?.editions[0]?.media.map((m) => m.id)).toEqual(
        rivalParts.map((p) => p.id),
      );
    });
  });

  it("leaves out recordings that are not ready", async () => {
    const db = getDb();

    const book = await createBook(db);
    const current = await createMedia(db, { bookId: book.id });
    await createMedia(db, { bookId: book.id, status: "processing" });

    const result = await getBookOtherEditions(
      DEFAULT_TEST_SESSION,
      makeMediaHeaderInfo(current.id, book.id, book.title),
      10,
    );

    expect(result).toBeNull();
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
