import { drizzle } from "drizzle-orm/expo-sqlite";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { openDatabaseSync, SQLiteDatabase } from "expo-sqlite";

import * as schema from "./schema";

let _expoDb: SQLiteDatabase | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getExpoDb(): SQLiteDatabase {
  if (!_expoDb) {
    _expoDb = openDatabaseSync("ambry.db", { enableChangeListener: true });
    _expoDb.execSync("PRAGMA journal_mode = WAL;");
  }
  return _expoDb;
}

export function getDb(): Database {
  if (!_db) {
    _db = drizzle(getExpoDb(), { schema });
  }
  return _db;
}

/**
 * Get the expo-sqlite drizzle instance with full type information.
 * Used by useMigrations hook which requires the specific expo-sqlite type.
 */
export function getExpoSqliteDb() {
  if (!_db) {
    _db = drizzle(getExpoDb(), { schema });
  }
  return _db;
}

/**
 * Common database type that works with both expo-sqlite (production)
 * and better-sqlite3 (tests). Use this type for functions that need
 * to accept either database implementation.
 */
export type Database = BaseSQLiteDatabase<
  "sync" | "async",
  unknown,
  typeof schema
>;
