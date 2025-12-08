/**
 * Tests for getPersonHeaderInfo query function.
 */

import { setupTestDatabase } from "@test/db-test-utils";
import {
  createAuthor,
  createNarrator,
  createPerson,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

import { getPersonHeaderInfo } from "../get-person-header-info";

const { getDb } = setupTestDatabase();

describe("getPersonHeaderInfo", () => {
  it("throws error when person not found", async () => {
    await expect(
      getPersonHeaderInfo(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("Person not found");
  });

  it("returns person with basic info", async () => {
    const db = getDb();

    const person = await createPerson(db, {
      name: "Brandon Sanderson",
      description: "Fantasy author",
      thumbnails: {
        thumbhash: "abc",
        extraSmall: "/thumbs/brandon-xs.jpg",
        small: "/thumbs/brandon.jpg",
        medium: "/thumbs/brandon-md.jpg",
        large: "/thumbs/brandon-lg.jpg",
        extraLarge: "/thumbs/brandon-xl.jpg",
      },
    });

    const result = await getPersonHeaderInfo(DEFAULT_TEST_SESSION, person.id);

    expect(result.id).toBe(person.id);
    expect(result.name).toBe("Brandon Sanderson");
    expect(result.description).toBe("Fantasy author");
    expect(result.thumbnails?.small).toBe("/thumbs/brandon.jpg");
  });

  it("returns person with related authors", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Brandon Sanderson" });
    const author1 = await createAuthor(db, {
      personId: person.id,
      name: "Brandon Sanderson",
    });
    const author2 = await createAuthor(db, {
      personId: person.id,
      name: "B. Sanderson",
    });

    const result = await getPersonHeaderInfo(DEFAULT_TEST_SESSION, person.id);

    expect(result.authors).toHaveLength(2);
    // Sorted by name
    expect(result.authors[0]?.name).toBe("B. Sanderson");
    expect(result.authors[1]?.name).toBe("Brandon Sanderson");
    expect(result.authors.map((a) => a.id)).toContain(author1.id);
    expect(result.authors.map((a) => a.id)).toContain(author2.id);
  });

  it("returns person with related narrators", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Stephen Fry" });
    const narrator1 = await createNarrator(db, {
      personId: person.id,
      name: "Stephen Fry",
    });
    const narrator2 = await createNarrator(db, {
      personId: person.id,
      name: "S. Fry",
    });

    const result = await getPersonHeaderInfo(DEFAULT_TEST_SESSION, person.id);

    expect(result.narrators).toHaveLength(2);
    // Sorted by name
    expect(result.narrators[0]?.name).toBe("S. Fry");
    expect(result.narrators[1]?.name).toBe("Stephen Fry");
    expect(result.narrators.map((n) => n.id)).toContain(narrator1.id);
    expect(result.narrators.map((n) => n.id)).toContain(narrator2.id);
  });

  it("returns person with both authors and narrators", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Neil Gaiman" });
    await createAuthor(db, { personId: person.id, name: "Neil Gaiman" });
    await createNarrator(db, { personId: person.id, name: "Neil Gaiman" });

    const result = await getPersonHeaderInfo(DEFAULT_TEST_SESSION, person.id);

    expect(result.authors).toHaveLength(1);
    expect(result.narrators).toHaveLength(1);
    expect(result.authors[0]?.name).toBe("Neil Gaiman");
    expect(result.narrators[0]?.name).toBe("Neil Gaiman");
  });

  it("returns empty arrays when person has no authors or narrators", async () => {
    const db = getDb();

    const person = await createPerson(db, { name: "Solo Person" });

    const result = await getPersonHeaderInfo(DEFAULT_TEST_SESSION, person.id);

    expect(result.authors).toEqual([]);
    expect(result.narrators).toEqual([]);
  });

  it("only returns person for the current session URL", async () => {
    const db = getDb();

    // Create person with a different URL
    await createPerson(db, {
      url: "https://other-server.com",
      id: "person-other-server",
    });

    // Should not find it with default session URL
    await expect(
      getPersonHeaderInfo(DEFAULT_TEST_SESSION, "person-other-server"),
    ).rejects.toThrow("Person not found");
  });
});
