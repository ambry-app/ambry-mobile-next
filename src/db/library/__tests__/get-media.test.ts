/**
 * Tests for getMedia query function.
 */

import { getMedia } from "@/db/library/get-media";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getMedia", () => {
  it("throws error when media not found", async () => {
    await expect(
      getMedia(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("Media with ID nonexistent-id not found");
  });

  it("returns media with book info", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "Pride and Prejudice" });
    const media = await createMedia(db, { bookId: book.id });

    const result = await getMedia(DEFAULT_TEST_SESSION, media.id);

    expect(result.id).toBe(media.id);
    expect(result.book.id).toBe(book.id);
    expect(result.book.title).toBe("Pride and Prejudice");
  });

  it("returns media with authors from book", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createBookAuthor(db, {
      bookId: media.bookId,
      author: { name: "Jane Austen" },
    });
    await createBookAuthor(db, {
      bookId: media.bookId,
      author: { name: "Editor Smith" },
    });

    const result = await getMedia(DEFAULT_TEST_SESSION, media.id);

    expect(result.book.authors).toHaveLength(2);
    expect(result.book.authors.map((a) => a.name)).toContain("Jane Austen");
    expect(result.book.authors.map((a) => a.name)).toContain("Editor Smith");
  });

  it("returns media with narrators", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Stephen Fry" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Emily Watson" },
    });

    const result = await getMedia(DEFAULT_TEST_SESSION, media.id);

    expect(result.narrators).toHaveLength(2);
    expect(result.narrators.map((n) => n.name)).toContain("Stephen Fry");
    expect(result.narrators.map((n) => n.name)).toContain("Emily Watson");
  });

  it("returns download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createDownload(db, {
      mediaId: media.id,
      status: "ready",
      thumbnails: {
        thumbhash: "downloadhash",
        extraSmall: "/download/xs.jpg",
        small: "/download/small.jpg",
        medium: "/download/medium.jpg",
        large: "/download/large.jpg",
        extraLarge: "/download/xl.jpg",
      },
    });

    const result = await getMedia(DEFAULT_TEST_SESSION, media.id);

    expect(result.download?.thumbnails?.thumbhash).toBe("downloadhash");
  });

  it("returns null/undefined download when media is not downloaded", async () => {
    const db = getDb();

    const media = await createMedia(db);

    const result = await getMedia(DEFAULT_TEST_SESSION, media.id);

    // When no download exists, the left join returns null/undefined thumbnails
    expect(result.download?.thumbnails).toBeFalsy();
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    // Create media with a different URL
    const book = await createBook(db, { url: "https://other-server.com" });
    await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      id: "media-other-server",
    });

    // Should not find it with default session URL
    await expect(
      getMedia(DEFAULT_TEST_SESSION, "media-other-server"),
    ).rejects.toThrow("Media with ID media-other-server not found");
  });
});
