/**
 * Test utilities for creating in-memory SQLite databases with Drizzle.
 * Uses better-sqlite3 (Node.js) instead of expo-sqlite (React Native).
 */
import Database from "better-sqlite3";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";

import * as schema from "@/db/schema";

import { clearTestDb, setTestDb } from "./jest-setup";

const MIGRATIONS_DIR = path.join(__dirname, "../drizzle");

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

type BaseBetterSQLite3Database = BetterSQLite3Database<typeof schema>;

/**
 * Extended database type that supports async transaction functions.
 * This matches expo-sqlite's async transaction API while using better-sqlite3 under the hood.
 *
 * We use Omit to remove the original sync transaction method and replace it with an async one.
 */
export type TestDatabase = Omit<BaseBetterSQLite3Database, "transaction"> & {
  transaction<T>(
    fn: (tx: BaseBetterSQLite3Database) => T | Promise<T>,
  ): Promise<T>;
};

/**
 * Wrap a better-sqlite3 drizzle database to support async transaction functions.
 *
 * better-sqlite3 is synchronous, but expo-sqlite (used in production) is async.
 * This wrapper allows the same async transaction API to work in tests.
 *
 * The key insight is that since better-sqlite3 is synchronous, all database
 * operations complete immediately. We use better-sqlite3's native transaction
 * to ensure atomicity, then await any promises from the callback.
 */
function wrapDatabaseForAsyncTransactions(
  db: BaseBetterSQLite3Database,
  sqlite: Database.Database,
): TestDatabase {
  // Create a proxy that intercepts the transaction method
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "transaction") {
        // Return our async-compatible transaction wrapper
        return async <T>(
          fn: (tx: BaseBetterSQLite3Database) => T | Promise<T>,
        ): Promise<T> => {
          // Use better-sqlite3's native transaction for atomicity
          // The transaction wrapper executes synchronously, but we handle
          // the async callback by awaiting its result after the sync transaction
          let resultOrPromise: T | Promise<T>;

          const nativeTx = sqlite.transaction(() => {
            // Pass the db itself as the "transaction" context
            // For better-sqlite3, this is fine since all operations are sync
            // and the native transaction handles atomicity
            resultOrPromise = fn(target);
          });

          // Execute the native transaction (this runs synchronously)
          nativeTx();

          // If the callback returned a promise, await it
          // (The actual DB operations have already completed synchronously)
          return resultOrPromise!;
        };
      }
      // For all other properties, return the original
      return Reflect.get(target, prop);
    },
  }) as unknown as TestDatabase;
}

/**
 * Create a fresh in-memory SQLite database with all migrations applied.
 * Each call returns a new isolated database instance.
 *
 * The returned database supports async transaction functions to match
 * expo-sqlite's API used in production code.
 *
 * @example
 * const { db, close } = createTestDatabase();
 * // ... run tests ...
 * close();
 */
export function createTestDatabase(): { db: TestDatabase; close: () => void } {
  const sqlite = new Database(":memory:");
  applyMigrations(sqlite);
  const baseDb = drizzle(sqlite, { schema });
  const db = wrapDatabaseForAsyncTransactions(baseDb, sqlite);

  return {
    db,
    close: () => sqlite.close(),
  };
}

/**
 * Jest helper that creates a fresh database before each test.
 * Automatically sets up the global getDb() mock and closes the database after each test.
 *
 * @example
 * describe("my tests", () => {
 *   const { getDb } = setupTestDatabase();
 *
 *   it("does something", () => {
 *     const db = getDb();
 *     // ... use db ...
 *   });
 * });
 */
export function setupTestDatabase() {
  let testDb: { db: TestDatabase; close: () => void } | null = null;

  beforeEach(() => {
    testDb = createTestDatabase();
    setTestDb(testDb.db);
  });

  afterEach(() => {
    clearTestDb();
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
