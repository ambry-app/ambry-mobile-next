import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * SQLite refuses to prepare a statement that binds more than
 * SQLITE_MAX_VARIABLE_NUMBER parameters, failing with "too many SQL variables".
 * Both expo-sqlite and better-sqlite3 build with the SQLite 3.32+ default of
 * 32766; we stay well under it.
 */
const MAX_SQL_VARIABLES = 30_000;

/**
 * Split rows into batches that can each be inserted into `table` in a single
 * statement. A multi-row insert binds one parameter per column per row, so a
 * first sync - which sends the entire library at once - overflows the limit
 * without this.
 */
export function chunkRowsForInsert<T>(table: SQLiteTable, rows: T[]): T[][] {
  const columnCount = Object.keys(getTableColumns(table)).length;

  return chunk(rows, Math.max(1, Math.floor(MAX_SQL_VARIABLES / columnCount)));
}

/**
 * Split values that are bound one parameter each - the id list of an `inArray`
 * filter, for example - into batches that stay under the limit.
 */
export function chunkBoundValues<T>(values: T[]): T[][] {
  return chunk(values, MAX_SQL_VARIABLES);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}
