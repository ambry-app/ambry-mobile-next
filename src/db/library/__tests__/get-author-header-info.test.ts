/**
 * Tests for getAuthorHeaderInfo query function.
 */

import { getAuthorHeaderInfo } from "@/db/library/get-author-header-info";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createAuthor,
  createPerson,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

describe("getAuthorHeaderInfo", () => {
  it("throws error when author not found", async () => {
    await expect(
      getAuthorHeaderInfo(DEFAULT_TEST_SESSION, "nonexistent-id"),
    ).rejects.toThrow("Author not found");
  });

  it("returns author with person info", async () => {
    const db = getDb();

    const person = await createPerson(db, {
      name: "Jane Austen",
      thumbnails: {
        thumbhash: "abc",
        extraSmall: "/thumbs/jane-xs.jpg",
        small: "/thumbs/jane.jpg",
        medium: "/thumbs/jane-md.jpg",
        large: "/thumbs/jane-lg.jpg",
        extraLarge: "/thumbs/jane-xl.jpg",
      },
    });
    const author = await createAuthor(db, {
      personId: person.id,
      name: "Jane Austen",
    });

    const result = await getAuthorHeaderInfo(DEFAULT_TEST_SESSION, author.id);

    expect(result.id).toBe(author.id);
    expect(result.name).toBe("Jane Austen");
    expect(result.person.id).toBe(person.id);
    expect(result.person.name).toBe("Jane Austen");
    expect(result.person.thumbnails?.small).toBe("/thumbs/jane.jpg");
  });

  it("only returns author for the current session URL", async () => {
    const db = getDb();

    // Create author with a different URL
    const person = await createPerson(db, { url: "https://other-server.com" });
    await createAuthor(db, {
      url: "https://other-server.com",
      personId: person.id,
      id: "author-other-server",
    });

    // Should not find it with default session URL
    await expect(
      getAuthorHeaderInfo(DEFAULT_TEST_SESSION, "author-other-server"),
    ).rejects.toThrow("Author not found");
  });
});
