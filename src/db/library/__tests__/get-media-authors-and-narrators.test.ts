/**
 * Tests for getMediaAuthorsAndNarrators query function.
 */

import { getMediaAuthorsAndNarrators } from "@/db/library/get-media-authors-and-narrators";
import { MediaHeaderInfo } from "@/db/library/get-media-header-info";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  createPerson,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

// Helper to create a minimal MediaHeaderInfo for testing
function makeMediaHeaderInfo(mediaId: string, bookId: string): MediaHeaderInfo {
  return {
    id: mediaId,
    fullCast: false,
    abridged: false,
    thumbnails: null,
    duration: "3600",
    mp4Path: null,
    description: null,
    published: null,
    publishedFormat: "full",
    publisher: null,
    notes: null,
    narrators: [],
    download: { thumbnails: null },
    book: {
      id: bookId,
      title: "Test Book",
      published: new Date(),
      publishedFormat: "full",
      authors: [],
      series: [],
    },
  };
}

describe("getMediaAuthorsAndNarrators", () => {
  it("returns empty array when no authors or narrators exist", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toEqual([]);
  });

  it("returns authors with type 'author'", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Jane Austen" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("author");
    expect(result[0]?.names).toContain("Jane Austen");
  });

  it("returns narrators with type 'narrator'", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Rosamund Pike" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("narrator");
    expect(result[0]?.names).toContain("Rosamund Pike");
  });

  it("combines person who is both author and narrator as 'authorAndNarrator'", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Neil Gaiman" });
    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Neil Gaiman" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { personId: person.id, name: "Neil Gaiman" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("authorAndNarrator");
    expect(result[0]?.realName).toBe("Neil Gaiman");
  });

  it("collects multiple pen names for the same person", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Stephen King" });
    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Stephen King" },
    });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Richard Bachman" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.names).toContain("Stephen King");
    expect(result[0]?.names).toContain("Richard Bachman");
    expect(result[0]?.realName).toBe("Stephen King");
  });

  it("returns separate entries for different people", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author One" },
    });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author Two" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator One" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.type === "author")).toHaveLength(2);
    expect(result.filter((r) => r.type === "narrator")).toHaveLength(1);
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
    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { personId: person.id, name: "Famous Author" },
    });

    const mediaHeaderInfo = makeMediaHeaderInfo(media.id, book.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result[0]?.thumbnails?.thumbhash).toBe("abc");
  });

  it("only returns authors and narrators for the current session URL", async () => {
    const db = getDb();

    // Create data for other server
    const otherBook = await createBook(db, { url: "https://other-server.com" });
    const otherMedia = await createMedia(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
    });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
      author: { url: "https://other-server.com", name: "Other Author" },
    });

    // Query with default session should not find other server's data
    const mediaHeaderInfo = makeMediaHeaderInfo(otherMedia.id, otherBook.id);
    const result = await getMediaAuthorsAndNarrators(
      DEFAULT_TEST_SESSION,
      mediaHeaderInfo,
    );

    expect(result).toEqual([]);
  });
});
