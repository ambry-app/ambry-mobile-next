import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

export const expoDb = openDatabaseSync("ambry.db");
expoDb.execSync("PRAGMA journal_mode = WAL;");
export const db = drizzle(expoDb, { schema, logger: true });
