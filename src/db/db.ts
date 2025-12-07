import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

export const expoDb = openDatabaseSync("ambry.db", {
  enableChangeListener: true,
});
expoDb.execSync("PRAGMA journal_mode = WAL;");

// export const db = drizzle(expoDb, { schema, logger: __DEV__ });
export const db = drizzle(expoDb, { schema });

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
