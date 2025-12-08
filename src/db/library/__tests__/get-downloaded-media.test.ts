/**
 * Tests for getDownloadedMedia query function.
 */

import { getDownloadedMedia } from "@/db/library/get-downloaded-media";
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

describe("getDownloadedMedia", () => {
  it("returns empty array for empty input", async () => {
    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, []);
    expect(result).toEqual([]);
  });

  it("returns downloaded media with book info", async () => {
    const db = getDb();

    const book = await createBook(db, { title: "The Great Gatsby" });
    const media = await createMedia(db, { bookId: book.id });
    await createDownload(db, {
      mediaId: media.id,
      status: "ready",
      thumbnails: {
        thumbhash: "abc",
        extraSmall: "/xs.jpg",
        small: "/small.jpg",
        medium: "/medium.jpg",
        large: "/large.jpg",
        extraLarge: "/xl.jpg",
      },
    });

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(media.id);
    expect(result[0]?.book.title).toBe("The Great Gatsby");
  });

  it("returns media with authors", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createBookAuthor(db, {
      bookId: media.bookId,
      author: { name: "F. Scott Fitzgerald" },
    });
    await createDownload(db, { mediaId: media.id, status: "ready" });

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result[0]?.book.authors).toHaveLength(1);
    expect(result[0]?.book.authors[0]?.name).toBe("F. Scott Fitzgerald");
  });

  it("returns media with narrators", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Jake Gyllenhaal" },
    });
    await createDownload(db, { mediaId: media.id, status: "ready" });

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result[0]?.narrators).toHaveLength(1);
    expect(result[0]?.narrators[0]?.name).toBe("Jake Gyllenhaal");
  });

  it("only returns media that have downloads", async () => {
    const db = getDb();

    const media1 = await createMedia(db);
    const media2 = await createMedia(db);
    await createDownload(db, { mediaId: media1.id, status: "ready" });
    // media2 has no download

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [
      media1.id,
      media2.id,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(media1.id);
  });

  it("returns multiple downloaded media", async () => {
    const db = getDb();

    const media1 = await createMedia(db);
    const media2 = await createMedia(db);
    await createDownload(db, { mediaId: media1.id, status: "ready" });
    await createDownload(db, { mediaId: media2.id, status: "ready" });

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [
      media1.id,
      media2.id,
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toContain(media1.id);
    expect(result.map((m) => m.id)).toContain(media2.id);
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    const media = await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      id: "media-other",
    });
    await createDownload(db, {
      url: "https://other-server.com",
      mediaId: media.id,
      status: "ready",
    });

    const result = await getDownloadedMedia(DEFAULT_TEST_SESSION, [
      "media-other",
    ]);

    expect(result).toHaveLength(0);
  });
});
