import { createTestDatabase, useTestDatabase } from "@test/db-test-utils";
import * as schema from "../schema";

describe("createTestDatabase", () => {
  it("creates an in-memory database with migrations applied", () => {
    const { db, close } = createTestDatabase();

    try {
      // Verify we can query the database (tables exist from migrations)
      const result = db.select().from(schema.books).all();
      expect(result).toEqual([]);
    } finally {
      close();
    }
  });

  it("creates isolated databases", () => {
    const { db: db1, close: close1 } = createTestDatabase();
    const { db: db2, close: close2 } = createTestDatabase();

    try {
      // Insert into db1
      const now = new Date();
      db1
        .insert(schema.books)
        .values({
          url: "http://test.com",
          id: "book-1",
          title: "Test Book",
          published: now,
          publishedFormat: "full",
          insertedAt: now,
          updatedAt: now,
        })
        .run();

      // db1 should have the book
      const books1 = db1.select().from(schema.books).all();
      expect(books1).toHaveLength(1);

      // db2 should be empty (isolated)
      const books2 = db2.select().from(schema.books).all();
      expect(books2).toHaveLength(0);
    } finally {
      close1();
      close2();
    }
  });
});

describe("useTestDatabase", () => {
  const { getDb } = useTestDatabase();

  it("provides a fresh database for each test", () => {
    const db = getDb();

    // Insert a book
    const now = new Date();
    db.insert(schema.books)
      .values({
        url: "http://test.com",
        id: "book-1",
        title: "Test Book",
        published: now,
        publishedFormat: "full",
        insertedAt: now,
        updatedAt: now,
      })
      .run();

    const books = db.select().from(schema.books).all();
    expect(books).toHaveLength(1);
  });

  it("has an empty database (previous test data is gone)", () => {
    const db = getDb();

    // Should be empty - previous test's data is gone
    const books = db.select().from(schema.books).all();
    expect(books).toHaveLength(0);
  });
});
