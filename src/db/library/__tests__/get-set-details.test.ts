import { getSetDetails } from "@/db/library/get-set-details";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createBookAuthor,
  createMedia,
  createMediaNarrator,
  createPerson,
  createRecordingGroup,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getSetDetails", () => {
  it("goes by the set's book, not the operator's label", async () => {
    const db = getDb();
    const book = await createBook(db, { title: "Leviathan Wakes" });
    const set = await createRecordingGroup(db, {
      bookId: book.id,
      partsTotal: 3,
    });

    const result = await getSetDetails(DEFAULT_TEST_SESSION, set.id);

    expect(result.book.title).toBe("Leviathan Wakes");
    expect(result.partsTotal).toBe(3);
  });

  it("carries the set's own wording for its parts", async () => {
    const db = getDb();
    const set = await createRecordingGroup(db, {
      partsTotal: 5,
      partWord: "volume",
      partWordPlural: "volumes",
    });

    const result = await getSetDetails(DEFAULT_TEST_SESSION, set.id);

    expect(result.partWord).toBe("volume");
    expect(result.partWordPlural).toBe("volumes");
  });

  it("lists both people behind a composite byline", async () => {
    const db = getDb();
    const abraham = await createPerson(db, { name: "Daniel Abraham" });
    const franck = await createPerson(db, { name: "Ty Franck" });
    const book = await createBook(db, { title: "Leviathan Wakes" });
    await createBookAuthor(db, {
      bookId: book.id,
      author: { name: "James S.A. Corey", personIds: [abraham.id, franck.id] },
    });
    const set = await createRecordingGroup(db, { bookId: book.id });

    const result = await getSetDetails(DEFAULT_TEST_SESSION, set.id);

    expect(
      result.authorsAndNarrators.map((entry) => entry.realName).sort(),
    ).toEqual(["Daniel Abraham", "Ty Franck"]);
  });

  it("collects narrators from across the set's recordings", async () => {
    const db = getDb();
    const book = await createBook(db);
    const set = await createRecordingGroup(db, { bookId: book.id });
    const partOne = await createMedia(db, {
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 1,
    });
    const partTwo = await createMedia(db, {
      bookId: book.id,
      recordingGroupId: set.id,
      partNumber: 2,
    });

    await createMediaNarrator(db, {
      mediaId: partOne.id,
      narrator: { name: "Jefferson Mays", person: { name: "Jefferson Mays" } },
    });
    await createMediaNarrator(db, {
      mediaId: partTwo.id,
      narrator: { name: "Erin Bennett", person: { name: "Erin Bennett" } },
    });

    const result = await getSetDetails(DEFAULT_TEST_SESSION, set.id);

    expect(
      result.authorsAndNarrators.map((entry) => entry.realName).sort(),
    ).toEqual(["Erin Bennett", "Jefferson Mays"]);
  });

  it("throws when the set does not exist", async () => {
    await expect(
      getSetDetails(DEFAULT_TEST_SESSION, "no-such-set"),
    ).rejects.toThrow();
  });
});
