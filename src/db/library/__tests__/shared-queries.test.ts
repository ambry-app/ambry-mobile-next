import {
  combineAuthorsAndNarrators,
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
} from "@/db/library/shared-queries";
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

// Helper to create test authors
function makeAuthor(
  id: string,
  name: string,
  personId: string,
  personName: string = personId,
) {
  return {
    type: "author" as const,
    id,
    name,
    person: { id: personId, name: personName, thumbnails: null },
  };
}

// Helper to create test narrators
function makeNarrator(
  id: string,
  name: string,
  personId: string,
  personName: string = personId,
) {
  return {
    type: "narrator" as const,
    id,
    name,
    person: { id: personId, name: personName, thumbnails: null },
  };
}

describe("combineAuthorsAndNarrators", () => {
  it("returns empty array for empty inputs", () => {
    expect(combineAuthorsAndNarrators([], [])).toEqual([]);
  });

  it("returns authors only when no narrators", () => {
    const authors = [makeAuthor("a1", "Stephen King", "p1", "Stephen King")];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toEqual([
      {
        id: "p1",
        type: "author",
        names: ["Stephen King"],
        realName: "Stephen King",
        thumbnails: null,
      },
    ]);
  });

  it("returns narrators only when no authors", () => {
    const narrators = [makeNarrator("n1", "James Earl Jones", "p2")];

    const result = combineAuthorsAndNarrators([], narrators);

    expect(result).toEqual([
      {
        id: "p2",
        type: "narrator",
        names: ["James Earl Jones"],
        realName: "p2",
        thumbnails: null,
      },
    ]);
  });

  it("combines separate authors and narrators", () => {
    const authors = [makeAuthor("a1", "Author One", "p1")];
    const narrators = [makeNarrator("n1", "Narrator One", "p2")];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      id: "p1",
      type: "author",
      names: ["Author One"],
      realName: "p1",
      thumbnails: null,
    });
    expect(result).toContainEqual({
      id: "p2",
      type: "narrator",
      names: ["Narrator One"],
      realName: "p2",
      thumbnails: null,
    });
  });

  it("marks person as authorAndNarrator when they have both roles", () => {
    const authors = [makeAuthor("a1", "Neil Gaiman", "p1", "Neil Gaiman")];
    const narrators = [makeNarrator("n1", "Neil Gaiman", "p1", "Neil Gaiman")];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "p1",
      type: "authorAndNarrator",
      names: ["Neil Gaiman"],
      realName: "Neil Gaiman",
      thumbnails: null,
    });
  });

  it("collects multiple pen names for the same person", () => {
    const authors = [
      makeAuthor("a1", "Richard Bachman", "p1", "Stephen King"),
      makeAuthor("a2", "Stephen King", "p1", "Stephen King"),
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "p1",
      type: "author",
      names: ["Richard Bachman", "Stephen King"],
      realName: "Stephen King",
      thumbnails: null,
    });
  });

  it("does not duplicate identical names", () => {
    const authors = [
      makeAuthor("a1", "Stephen King", "p1", "Stephen King"),
      makeAuthor("a2", "Stephen King", "p1", "Stephen King"),
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toHaveLength(1);
    expect(result[0]?.names).toEqual(["Stephen King"]);
  });

  it("handles complex scenario with multiple people and roles", () => {
    const authors = [
      makeAuthor("a1", "Author A", "p1"),
      makeAuthor("a2", "Pen Name A", "p1"),
      makeAuthor("a3", "Author B", "p2"),
    ];
    const narrators = [
      makeNarrator("n1", "Author A", "p1"), // Same person, also narrates
      makeNarrator("n2", "Narrator C", "p3"),
    ];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(3);

    const p1 = result.find((r) => r.id === "p1");
    expect(p1).toEqual({
      id: "p1",
      type: "authorAndNarrator",
      names: ["Author A", "Pen Name A"],
      realName: "p1",
      thumbnails: null,
    });

    const p2 = result.find((r) => r.id === "p2");
    expect(p2?.type).toBe("author");

    const p3 = result.find((r) => r.id === "p3");
    expect(p3?.type).toBe("narrator");
  });

  it("preserves thumbnails from the first entry", () => {
    // Use a mock thumbnails object - we just care that it's passed through
    const thumbnails = { mock: "thumbnails" } as unknown as Parameters<
      typeof combineAuthorsAndNarrators
    >[0][0]["person"]["thumbnails"];
    const authors = [
      {
        type: "author" as const,
        id: "a1",
        name: "Author",
        person: { id: "p1", name: "Real Name", thumbnails },
      },
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result[0]?.thumbnails).toBe(thumbnails);
  });

  it("maintains insertion order from authors then narrators", () => {
    const authors = [
      makeAuthor("a1", "First Author", "p1"),
      makeAuthor("a2", "Second Author", "p2"),
    ];
    const narrators = [
      makeNarrator("n1", "Third Person", "p3"),
      makeNarrator("n2", "Fourth Person", "p4"),
    ];

    const result = combineAuthorsAndNarrators(authors, narrators);
    const ids = result.map((r) => r.id);

    expect(ids).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

// =============================================================================
// getAuthorsForBooks
// =============================================================================

describe("getAuthorsForBooks", () => {
  it("returns empty object for empty input", async () => {
    const result = await getAuthorsForBooks(DEFAULT_TEST_SESSION, []);
    expect(result).toEqual({});
  });

  it("returns authors mapped by book ID", async () => {
    const db = getDb();

    const book = await createBook(db);
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author One" },
    });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "Author Two" },
    });

    const result = await getAuthorsForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]).toHaveLength(2);
    expect(result[book.id]?.map((a) => a.name)).toContain("Author One");
    expect(result[book.id]?.map((a) => a.name)).toContain("Author Two");
  });

  it("returns authors for multiple books", async () => {
    const db = getDb();

    const book1 = await createBook(db, { title: "Book 1" });
    const book2 = await createBook(db, { title: "Book 2" });
    await createBookAuthor(db, {
      bookId: book1.id,
      author: { name: "Author A" },
    });
    await createBookAuthor(db, {
      bookId: book2.id,
      author: { name: "Author B" },
    });

    const result = await getAuthorsForBooks(DEFAULT_TEST_SESSION, [
      book1.id,
      book2.id,
    ]);

    expect(result[book1.id]).toHaveLength(1);
    expect(result[book1.id]?.[0]?.name).toBe("Author A");
    expect(result[book2.id]).toHaveLength(1);
    expect(result[book2.id]?.[0]?.name).toBe("Author B");
  });

  it("returns empty array for book with no authors", async () => {
    const db = getDb();

    const book = await createBook(db);

    const result = await getAuthorsForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]).toBeUndefined();
  });

  it("only returns authors for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    await createBookAuthor(db, {
      url: "https://other-server.com",
      bookId: book.id,
      author: { url: "https://other-server.com", name: "Other Author" },
    });

    const result = await getAuthorsForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]).toBeUndefined();
  });
});

// =============================================================================
// getMediaForBooks
// =============================================================================

describe("getMediaForBooks", () => {
  it("returns empty object for empty input", async () => {
    const result = await getMediaForBooks(DEFAULT_TEST_SESSION, []);
    expect(result).toEqual({});
  });

  it("returns media mapped by book ID", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media1 = await createMedia(db, { bookId: book.id });
    const media2 = await createMedia(db, { bookId: book.id });

    const result = await getMediaForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]).toHaveLength(2);
    expect(result[book.id]?.map((m) => m.id)).toContain(media1.id);
    expect(result[book.id]?.map((m) => m.id)).toContain(media2.id);
  });

  it("includes download thumbnails when media is downloaded", async () => {
    const db = getDb();

    const book = await createBook(db);
    const media = await createMedia(db, { bookId: book.id });
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

    const result = await getMediaForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]?.[0]?.download?.thumbnails?.thumbhash).toBe(
      "downloadhash",
    );
  });

  it("returns media for multiple books", async () => {
    const db = getDb();

    const book1 = await createBook(db);
    const book2 = await createBook(db);
    const media1 = await createMedia(db, { bookId: book1.id });
    const media2 = await createMedia(db, { bookId: book2.id });

    const result = await getMediaForBooks(DEFAULT_TEST_SESSION, [
      book1.id,
      book2.id,
    ]);

    expect(result[book1.id]?.[0]?.id).toBe(media1.id);
    expect(result[book2.id]?.[0]?.id).toBe(media2.id);
  });

  it("only returns media for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    await createMedia(db, { url: "https://other-server.com", bookId: book.id });

    const result = await getMediaForBooks(DEFAULT_TEST_SESSION, [book.id]);

    expect(result[book.id]).toBeUndefined();
  });
});

// =============================================================================
// getNarratorsForMedia
// =============================================================================

describe("getNarratorsForMedia", () => {
  it("returns empty object for empty input", async () => {
    const result = await getNarratorsForMedia(DEFAULT_TEST_SESSION, []);
    expect(result).toEqual({});
  });

  it("returns narrators mapped by media ID", async () => {
    const db = getDb();

    const media = await createMedia(db);
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator One" },
    });
    await createMediaNarrator(db, {
      mediaId: media.id,
      narrator: { name: "Narrator Two" },
    });

    const result = await getNarratorsForMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result[media.id]).toHaveLength(2);
    expect(result[media.id]?.map((n) => n.name)).toContain("Narrator One");
    expect(result[media.id]?.map((n) => n.name)).toContain("Narrator Two");
  });

  it("returns narrators for multiple media", async () => {
    const db = getDb();

    const media1 = await createMedia(db);
    const media2 = await createMedia(db);
    await createMediaNarrator(db, {
      mediaId: media1.id,
      narrator: { name: "Narrator A" },
    });
    await createMediaNarrator(db, {
      mediaId: media2.id,
      narrator: { name: "Narrator B" },
    });

    const result = await getNarratorsForMedia(DEFAULT_TEST_SESSION, [
      media1.id,
      media2.id,
    ]);

    expect(result[media1.id]?.[0]?.name).toBe("Narrator A");
    expect(result[media2.id]?.[0]?.name).toBe("Narrator B");
  });

  it("returns undefined for media with no narrators", async () => {
    const db = getDb();

    const media = await createMedia(db);

    const result = await getNarratorsForMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result[media.id]).toBeUndefined();
  });

  it("only returns narrators for the current session URL", async () => {
    const db = getDb();

    const book = await createBook(db, { url: "https://other-server.com" });
    const media = await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
    });
    await createMediaNarrator(db, {
      url: "https://other-server.com",
      mediaId: media.id,
      narrator: { url: "https://other-server.com", name: "Other Narrator" },
    });

    const result = await getNarratorsForMedia(DEFAULT_TEST_SESSION, [media.id]);

    expect(result[media.id]).toBeUndefined();
  });
});
