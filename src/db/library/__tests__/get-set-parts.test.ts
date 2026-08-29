import { getSetParts } from "@/db/library/get-set-parts";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createMedia,
  createRecordingGroup,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getSetParts", () => {
  it("returns the set's recordings in part order", async () => {
    const db = getDb();
    const book = await createBook(db, { title: "Leviathan Wakes" });
    const set = await createRecordingGroup(db, { bookId: book.id });

    // inserted out of order on purpose
    await createMedia(db, {
      id: "part-3",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 3,
    });
    await createMedia(db, {
      id: "part-1",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });
    await createMedia(db, {
      id: "part-2",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 2,
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id);

    expect(parts.map((part) => part.id)).toEqual([
      "part-1",
      "part-2",
      "part-3",
    ]);
    expect(parts.map((part) => part.partNumber)).toEqual([1, 2, 3]);
  });

  it("keeps unlisted sibling parts reachable", async () => {
    const db = getDb();
    const book = await createBook(db);
    const set = await createRecordingGroup(db, { bookId: book.id });

    await createMedia(db, {
      id: "part-1",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });
    await createMedia(db, {
      id: "part-2",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 2,
      unlistedAt: new Date(),
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id);

    expect(parts.map((part) => part.id)).toEqual(["part-1", "part-2"]);
  });

  it("leaves out the recording the reader is already on", async () => {
    const db = getDb();
    const book = await createBook(db);
    const set = await createRecordingGroup(db, { bookId: book.id });

    await createMedia(db, {
      id: "part-1",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });
    await createMedia(db, {
      id: "part-2",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 2,
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id, {
      excludeMediaId: "part-1",
    });

    expect(parts.map((part) => part.id)).toEqual(["part-2"]);
  });

  it("does not include recordings from another set", async () => {
    const db = getDb();
    const book = await createBook(db);
    const set = await createRecordingGroup(db, { bookId: book.id });
    const otherSet = await createRecordingGroup(db, { bookId: book.id });

    await createMedia(db, {
      id: "ours",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });
    await createMedia(db, {
      id: "theirs",
      bookId: book.id,
      recordingGroupId: otherSet.id,
      partNumber: 1,
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id);

    expect(parts.map((part) => part.id)).toEqual(["ours"]);
  });

  it("carries each part's own title so tiles can tell them apart", async () => {
    const db = getDb();
    const book = await createBook(db, { title: "Leviathan Wakes" });
    const set = await createRecordingGroup(db, { bookId: book.id });

    await createMedia(db, {
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
      title: "Leviathan Wakes: The Beginning",
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id);

    expect(parts[0]!.title).toBe("Leviathan Wakes: The Beginning");
    expect(parts[0]!.book.title).toBe("Leviathan Wakes");
  });

  it("only returns recordings for the current session URL", async () => {
    const db = getDb();
    const book = await createBook(db, { url: "https://other-server.com" });
    const set = await createRecordingGroup(db, {
      url: "https://other-server.com",
      bookId: book.id,
    });
    await createMedia(db, {
      url: "https://other-server.com",
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });

    const parts = await getSetParts(DEFAULT_TEST_SESSION, set.id);

    expect(parts).toEqual([]);
  });
});
