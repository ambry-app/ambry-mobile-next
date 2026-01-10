import { useEffect, useState } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { getExpoDb, getExpoSqliteDb } from "@/db/db";
import {
  migrateFromPlayerStateToPlaythrough,
  needsPlayerStateMigration,
} from "@/db/migration-player-state";
import { logBase } from "@/utils/logger";
import migrations from "@drizzle/migrations";

const log = logBase.extend("db-service");

/**
 * Hook that handles all database migrations:
 * 1. Drizzle schema migrations (DDL changes)
 * 2. One-off data migrations (e.g., PlayerState → Playthrough)
 *
 * Callers don't need to know about specific migrations - they just wait for
 * success to be true before proceeding.
 *
 * @returns success - true when ALL migrations have completed successfully
 * @returns error - Error object if any migration failed
 */
export function useDatabaseMigrations() {
  const { success: schemaSuccess, error: schemaError } = useMigrations(
    getExpoSqliteDb(),
    migrations,
  );
  const [dataMigrationsComplete, setDataMigrationsComplete] = useState(false);
  const [dataMigrationError, setDataMigrationError] = useState<Error>();

  // Run one-off data migrations after schema migrations complete
  useEffect(() => {
    async function runDataMigrations() {
      if (!schemaSuccess) return;

      try {
        // PlayerState → Playthrough migration
        if (await needsPlayerStateMigration()) {
          log.info("Running PlayerState migration...");
          await migrateFromPlayerStateToPlaythrough();
          log.info("PlayerState migration complete");
        }

        // Future one-off migrations can be added here

        setDataMigrationsComplete(true);
      } catch (e) {
        log.error("Data migration error", e);
        setDataMigrationError(
          e instanceof Error ? e : new Error("Data migration failed"),
        );
        // Still mark as complete so app can boot (migrations are best-effort)
        setDataMigrationsComplete(true);
      }
    }

    runDataMigrations();
  }, [schemaSuccess]);

  return {
    success: schemaSuccess && dataMigrationsComplete,
    error: schemaError ?? dataMigrationError,
  };
}

/**
 * Performs a WAL checkpoint to flush Write-Ahead Log to the main database file.
 * Call this periodically (e.g., after sync) to prevent WAL file from growing too large.
 */
export function performWalCheckpoint(): void {
  getExpoDb().execSync("PRAGMA wal_checkpoint(PASSIVE);");
}
