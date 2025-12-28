/**
 * Tests for getOtherMediaByNarrators query function.
 */

import { MediaHeaderInfo } from "@/db/library/get-media-header-info";
import { getOtherMediaByNarrators } from "@/db/library/get-other-media-by-narrators";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createAuthor,
  createBook,
  createBookAuthor,
  createDownload,
  createMedia,
  createMediaNarrator,
  createNarrator,
  createPerson,
  createSeries,
  createSeriesBook,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

// Helper to create narrator info for makeMediaHeaderInfo
function makeNarratorInfo(
  narrator: { id: string; name: string },
  person: { id: string; name: string },
) {
  return {
    id: narrator.id,
    name: narrator.name,
    person: { id: person.id, name: person.name },
  };
}

// Helper to create author info for makeMediaHeaderInfo
function makeAuthorInfo(
  author: { id: string; name: string },
  person: { id: string; name: string },
) {
  return {
    id: author.id,
    name: author.name,
    person: { id: person.id, name: person.name },
  };
}

// Helper to create series info for makeMediaHeaderInfo
function makeSeriesInfo(
  series: { id: string; name: string },
  bookNumber = "1",
) {
  return { id: series.id, bookNumber, name: series.name };
}

// Helper to create a minimal MediaHeaderInfo for testing
function makeMediaHeaderInfo(
  mediaId: string,
  bookId: string,
  narrators: {
    id: string;
    name: string;
    person: { id: string; name: string };
  }[],
  authors: {
    id: string;
    name: string;
    person: { id: string; name: string };
  }[] = [],
  series: { id: string; bookNumber: string; name: string }[] = [],
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
    narrators,
    download: { thumbnails: null },
    book: {
      id: bookId,
      title: "Current Book",
      published: new Date(),
      publishedFormat: "full",
      authors,
      series,
    },
  };
}

describe("getOtherMediaByNarrators", () => {
  it("returns empty array when media has no narrators", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });

    const mediaInfo = makeMediaHeaderInfo(media.id, book.id, []);

    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result).toEqual([]);
  });

  it("returns other media by the same narrator", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Stephen Fry" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Stephen Fry",
    });

    // Current media
    const currentBook = await createBook(db, { title: "Current Book" });
    const authorPerson = await createPerson(db, { name: "Current Author" });
    const currentAuthor = await createAuthor(db, {
      personId: authorPerson.id,
      name: "Current Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Other media by same narrator
    const otherBook = await createBook(db, { title: "Other Book" });
    const otherAuthor = await createAuthor(db, { name: "Other Author" });
    await createBookAuthor(db, {
      bookId: otherBook.id,
      authorId: otherAuthor.id,
    });
    const otherMedia = await createMedia(db, { bookId: otherBook.id });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, authorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Stephen Fry");
    expect(result[0]?.media).toHaveLength(1);
    expect(result[0]?.media[0]?.book.title).toBe("Other Book");
  });

  it("excludes the current media from results", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });

    const book1 = await createBook(db, { title: "Book 1" });
    const author1Person = await createPerson(db, { name: "Author 1" });
    const author1 = await createAuthor(db, {
      personId: author1Person.id,
      name: "Author 1",
    });
    await createBookAuthor(db, { bookId: book1.id, authorId: author1.id });
    const currentMedia = await createMedia(db, { bookId: book1.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    const book2 = await createBook(db, { title: "Book 2" });
    const author2 = await createAuthor(db, { name: "Author 2" });
    await createBookAuthor(db, { bookId: book2.id, authorId: author2.id });
    const otherMedia = await createMedia(db, { bookId: book2.id });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      book1.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(author1, author1Person)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media).toHaveLength(1);
    expect(result[0]?.media[0]?.id).toBe(otherMedia.id);
  });

  it("excludes media by the same author", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });

    // Shared author
    const sharedAuthorPerson = await createPerson(db, { name: "Same Author" });
    const sharedAuthor = await createAuthor(db, {
      personId: sharedAuthorPerson.id,
      name: "Same Author",
    });

    // Current media
    const currentBook = await createBook(db, { title: "Current Book" });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: sharedAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Media by same author (should be excluded)
    const sameAuthorBook = await createBook(db, { title: "Same Author Book" });
    await createBookAuthor(db, {
      bookId: sameAuthorBook.id,
      authorId: sharedAuthor.id,
    });
    const sameAuthorMedia = await createMedia(db, {
      bookId: sameAuthorBook.id,
    });
    await createMediaNarrator(db, {
      mediaId: sameAuthorMedia.id,
      narratorId: narrator.id,
    });

    // Media by different author (should be included)
    const differentAuthor = await createAuthor(db, {
      name: "Different Author",
    });
    const differentBook = await createBook(db, { title: "Different Book" });
    await createBookAuthor(db, {
      bookId: differentBook.id,
      authorId: differentAuthor.id,
    });
    const differentMedia = await createMedia(db, { bookId: differentBook.id });
    await createMediaNarrator(db, {
      mediaId: differentMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(sharedAuthor, sharedAuthorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media).toHaveLength(1);
    expect(result[0]?.media[0]?.book.title).toBe("Different Book");
  });

  it("excludes media in the same series", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });
    const series = await createSeries(db, { name: "Test Series" });

    // Current media in series
    const currentBook = await createBook(db, { title: "Book 1" });
    const currentAuthorPerson = await createPerson(db, {
      name: "Series Author",
    });
    const currentAuthor = await createAuthor(db, {
      personId: currentAuthorPerson.id,
      name: "Series Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    await createSeriesBook(db, { seriesId: series.id, bookId: currentBook.id });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Other media in same series (should be excluded)
    const seriesBook2 = await createBook(db, { title: "Book 2" });
    const differentAuthor = await createAuthor(db, {
      name: "Different Author",
    });
    await createBookAuthor(db, {
      bookId: seriesBook2.id,
      authorId: differentAuthor.id,
    });
    await createSeriesBook(db, { seriesId: series.id, bookId: seriesBook2.id });
    const seriesMedia = await createMedia(db, { bookId: seriesBook2.id });
    await createMediaNarrator(db, {
      mediaId: seriesMedia.id,
      narratorId: narrator.id,
    });

    // Standalone media (should be included)
    const standaloneBook = await createBook(db, { title: "Standalone" });
    const standaloneAuthor = await createAuthor(db, {
      name: "Standalone Author",
    });
    await createBookAuthor(db, {
      bookId: standaloneBook.id,
      authorId: standaloneAuthor.id,
    });
    const standaloneMedia = await createMedia(db, {
      bookId: standaloneBook.id,
    });
    await createMediaNarrator(db, {
      mediaId: standaloneMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, currentAuthorPerson)],
      [makeSeriesInfo(series)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media).toHaveLength(1);
    expect(result[0]?.media[0]?.book.title).toBe("Standalone");
  });

  it("includes book with authors for each media", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });

    // Current media
    const currentBook = await createBook(db);
    const currentAuthorPerson = await createPerson(db, {
      name: "Current Author",
    });
    const currentAuthor = await createAuthor(db, {
      personId: currentAuthorPerson.id,
      name: "Current Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Other media
    const otherBook = await createBook(db, { title: "Other Book" });
    const otherAuthor = await createAuthor(db, { name: "Jane Austen" });
    await createBookAuthor(db, {
      bookId: otherBook.id,
      authorId: otherAuthor.id,
    });
    const otherMedia = await createMedia(db, { bookId: otherBook.id });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, currentAuthorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media[0]?.book.authors).toHaveLength(1);
    expect(result[0]?.media[0]?.book.authors[0]?.name).toBe("Jane Austen");
  });

  it("includes all narrators for each media", async () => {
    const db = getDb();

    const narratorPerson1 = await createPerson(db, { name: "Narrator One" });
    const narrator1 = await createNarrator(db, {
      personId: narratorPerson1.id,
      name: "Narrator One",
    });
    const narratorPerson2 = await createPerson(db, { name: "Narrator Two" });
    const narrator2 = await createNarrator(db, {
      personId: narratorPerson2.id,
      name: "Narrator Two",
    });

    // Current media
    const currentBook = await createBook(db);
    const currentAuthorPerson = await createPerson(db, {
      name: "Current Author",
    });
    const currentAuthor = await createAuthor(db, {
      personId: currentAuthorPerson.id,
      name: "Current Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator1.id,
    });

    // Other media with two narrators
    const otherBook = await createBook(db);
    const otherAuthor = await createAuthor(db, { name: "Other Author" });
    await createBookAuthor(db, {
      bookId: otherBook.id,
      authorId: otherAuthor.id,
    });
    const otherMedia = await createMedia(db, { bookId: otherBook.id });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator1.id,
    });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator2.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator1, narratorPerson1)],
      [makeAuthorInfo(currentAuthor, currentAuthorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media[0]?.narrators).toHaveLength(2);
  });

  it("includes download thumbnails", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });

    // Current media
    const currentBook = await createBook(db);
    const currentAuthorPerson = await createPerson(db, {
      name: "Current Author",
    });
    const currentAuthor = await createAuthor(db, {
      personId: currentAuthorPerson.id,
      name: "Current Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Other media with download
    const otherBook = await createBook(db);
    const otherAuthor = await createAuthor(db, { name: "Other Author" });
    await createBookAuthor(db, {
      bookId: otherBook.id,
      authorId: otherAuthor.id,
    });
    const otherMedia = await createMedia(db, { bookId: otherBook.id });
    await createMediaNarrator(db, {
      mediaId: otherMedia.id,
      narratorId: narrator.id,
    });
    await createDownload(db, {
      mediaId: otherMedia.id,
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

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, currentAuthorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result[0]?.media[0]?.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("respects the media limit per narrator", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, { name: "Narrator" });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "Narrator",
    });

    // Current media
    const currentBook = await createBook(db);
    const currentAuthorPerson = await createPerson(db, {
      name: "Current Author",
    });
    const currentAuthor = await createAuthor(db, {
      personId: currentAuthorPerson.id,
      name: "Current Author",
    });
    await createBookAuthor(db, {
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, { bookId: currentBook.id });
    await createMediaNarrator(db, {
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Create multiple other media
    for (let i = 0; i < 5; i++) {
      const book = await createBook(db, { published: new Date(2020, i, 1) });
      const author = await createAuthor(db, { name: `Author ${i}` });
      await createBookAuthor(db, { bookId: book.id, authorId: author.id });
      const media = await createMedia(db, { bookId: book.id });
      await createMediaNarrator(db, {
        mediaId: media.id,
        narratorId: narrator.id,
      });
    }

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, currentAuthorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      3,
    );

    expect(result[0]?.media).toHaveLength(3);
  });

  it("returns narrator with empty media array if no other media exists", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, {
      name: "One Media Narrator",
    });
    const narrator = await createNarrator(db, {
      personId: narratorPerson.id,
      name: "One Media Narrator",
    });

    const book = await createBook(db);
    const authorPerson = await createPerson(db, { name: "Author" });
    const author = await createAuthor(db, {
      personId: authorPerson.id,
      name: "Author",
    });
    await createBookAuthor(db, { bookId: book.id, authorId: author.id });
    const media = await createMedia(db, { bookId: book.id });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      media.id,
      book.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(author, authorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("One Media Narrator");
    expect(result[0]?.media).toEqual([]);
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const narratorPerson = await createPerson(db, {
      url: "https://other-server.com",
    });
    const narrator = await createNarrator(db, {
      url: "https://other-server.com",
      personId: narratorPerson.id,
      name: "Narrator",
    });

    // Current media
    const currentBook = await createBook(db, {
      url: "https://other-server.com",
    });
    const authorPerson = await createPerson(db, {
      url: "https://other-server.com",
      name: "Author",
    });
    const currentAuthor = await createAuthor(db, {
      url: "https://other-server.com",
      personId: authorPerson.id,
      name: "Author",
    });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: currentBook.id,
      authorId: currentAuthor.id,
    });
    const currentMedia = await createMedia(db, {
      url: "https://other-server.com",
      bookId: currentBook.id,
    });
    await createMediaNarrator(db, {
      url: "https://other-server.com",
      mediaId: currentMedia.id,
      narratorId: narrator.id,
    });

    // Other media
    const otherBook = await createBook(db, { url: "https://other-server.com" });
    const otherAuthor = await createAuthor(db, {
      url: "https://other-server.com",
      name: "Other Author",
    });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
      authorId: otherAuthor.id,
    });
    const otherMedia = await createMedia(db, {
      url: "https://other-server.com",
      bookId: otherBook.id,
    });
    await createMediaNarrator(db, {
      url: "https://other-server.com",
      mediaId: otherMedia.id,
      narratorId: narrator.id,
    });

    const mediaInfo = makeMediaHeaderInfo(
      currentMedia.id,
      currentBook.id,
      [makeNarratorInfo(narrator, narratorPerson)],
      [makeAuthorInfo(currentAuthor, authorPerson)],
    );
    const result = await getOtherMediaByNarrators(
      DEFAULT_TEST_SESSION,
      mediaInfo,
      10,
    );

    // Narrator is passed in, but media should be empty since it's from different URL
    expect(result[0]?.media).toEqual([]);
  });
});
