/**
 * Test utilities for creating in-memory SQLite databases with Drizzle.
 * Uses better-sqlite3 (Node.js) instead of expo-sqlite (React Native).
 */
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as schema from "./schema";

const MIGRATIONS_DIR = path.join(__dirname, "../../drizzle");

/**
 * Apply all migrations to a database in order.
 */
function applyMigrations(sqlite: Database.Database): void {
  const journalPath = path.join(MIGRATIONS_DIR, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  for (const entry of journal.entries) {
    const filePath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Split by statement-breakpoint (same as Drizzle's migrator)
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      sqlite.exec(statement);
    }
  }
}

export type TestDatabase = BetterSQLite3Database<typeof schema>;

/**
 * Create a fresh in-memory SQLite database with all migrations applied.
 * Each call returns a new isolated database instance.
 *
 * @example
 * const { db, close } = createTestDatabase();
 * // ... run tests ...
 * close();
 */
export function createTestDatabase(): { db: TestDatabase; close: () => void } {
  const sqlite = new Database(":memory:");
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });

  return {
    db,
    close: () => sqlite.close(),
  };
}

/**
 * Jest helper that creates a fresh database before each test.
 * Automatically closes the database after each test.
 *
 * @example
 * describe("my tests", () => {
 *   const { getDb } = useTestDatabase();
 *
 *   it("does something", () => {
 *     const db = getDb();
 *     // ... use db ...
 *   });
 * });
 */
export function useTestDatabase() {
  let testDb: { db: TestDatabase; close: () => void } | null = null;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb?.close();
    testDb = null;
  });

  return {
    getDb: () => {
      if (!testDb) {
        throw new Error(
          "Test database not initialized. Are you inside a test?",
        );
      }
      return testDb.db;
    },
  };
}
