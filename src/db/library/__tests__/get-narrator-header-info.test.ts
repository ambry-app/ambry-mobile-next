/**
 * Tests for getNarratorHeaderInfo query function.
 */

import { setupTestDatabase } from "@test/db-test-utils";
import {
  createNarrator,
  createPerson,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

import { getNarratorHeaderInfo } from "../get-narrator-header-info";

const { getDb } = setupTestDatabase();

describe("getNarratorHeaderInfo", () => {
  it("throws error when narrator not found", async () => {
    await expect(
      getNarratorHeaderInfo(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("Narrator not found");
  });

  it("returns narrator with person info", async () => {
    const db = getDb();

    const person = await createPerson(db, {
      name: "Stephen Fry",
      thumbnails: {
        thumbhash: "abc",
        extraSmall: "/thumbs/stephen-xs.jpg",
        small: "/thumbs/stephen.jpg",
        medium: "/thumbs/stephen-md.jpg",
        large: "/thumbs/stephen-lg.jpg",
        extraLarge: "/thumbs/stephen-xl.jpg",
      },
    });
    const narrator = await createNarrator(db, {
      personId: person.id,
      name: "Stephen Fry",
    });

    const result = await getNarratorHeaderInfo(
      DEFAULT_TEST_SESSION,
      narrator.id,
    );

    expect(result.id).toBe(narrator.id);
    expect(result.name).toBe("Stephen Fry");
    expect(result.person.id).toBe(person.id);
    expect(result.person.name).toBe("Stephen Fry");
    expect(result.person.thumbnails?.small).toBe("/thumbs/stephen.jpg");
  });

  it("only returns narrator for the current session URL", async () => {
    const db = getDb();

    // Create narrator with a different URL
    const person = await createPerson(db, { url: "https://other-server.com" });
    await createNarrator(db, {
      url: "https://other-server.com",
      personId: person.id,
      id: "narrator-other-server",
    });

    // Should not find it with default session URL
    await expect(
      getNarratorHeaderInfo(DEFAULT_TEST_SESSION, "narrator-other-server"),
    ).rejects.toThrow("Narrator not found");
  });
});
