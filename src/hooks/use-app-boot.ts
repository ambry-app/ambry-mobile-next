import { useEffect, useState } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { getExpoSqliteDb } from "@/db/db";
import {
  migrateFromPlayerStateToPlaythrough,
  needsPlayerStateMigration,
} from "@/db/migration-player-state";
import { registerBackgroundSyncTask } from "@/services/background-sync-service";
import { initializeDataVersion } from "@/services/data-version-service";
import { initializeDownloads } from "@/services/download-service";
import { initializePlayer } from "@/services/playback-controls";
import { initializeSleepTimer } from "@/services/sleep-timer-service";
import { sync } from "@/services/sync-service";
import { initializeDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import migrations from "@drizzle/migrations";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const [playerStateMigrationComplete, setPlayerStateMigrationComplete] =
    useState(false);
  const { success: migrationSuccess, error: migrationError } = useMigrations(
    getExpoSqliteDb(),
    migrations,
  );
  const session = useSession((state) => state.session);

  // Step 2: PlayerState migration (after Drizzle migrations, before boot)
  useEffect(() => {
    async function runPlayerStateMigration() {
      if (!migrationSuccess) return;

      const shouldMigrate = await needsPlayerStateMigration();
      if (shouldMigrate) {
        console.debug("[AppBoot] Old PlayerState data detected, migrating...");
        try {
          await migrateFromPlayerStateToPlaythrough();
          console.debug("[AppBoot] PlayerState migration complete");
        } catch (e) {
          console.error("[AppBoot] PlayerState migration error", e);
          // Continue boot even if migration fails
        }
      }

      setPlayerStateMigrationComplete(true);
    }

    runPlayerStateMigration();
  }, [migrationSuccess]);

  // Step 3: Boot (session-dependent initialization)
  useEffect(() => {
    async function boot() {
      if (!session) {
        console.debug("[AppBoot] No session");
        setIsReady(true);
        return;
      }

      console.debug("[AppBoot] Starting");

      // Initialize device
      await initializeDevice();

      // Initialize remaining stores (each handles its own "already initialized" check)
      const { needsInitialSync } = await initializeDataVersion(session);
      await initializeDownloads(session);
      await initializeSleepTimer(session);

      // Initial sync if needed
      if (needsInitialSync) {
        try {
          console.debug("[AppBoot] Initial sync...");
          await sync(session);
          console.debug("[AppBoot] Initial sync complete");
        } catch (e) {
          console.error("[AppBoot] Initial sync error", e);
        }
      }
      setInitialSyncComplete(true);

      // Initialize player (sets up TrackPlayer and loads most recent media)
      await initializePlayer(session);

      // Register background sync
      try {
        await registerBackgroundSyncTask();
      } catch (e) {
        console.error("[AppBoot] Background sync registration error", e);
      }

      console.debug("[AppBoot] Complete");
      setIsReady(true);
    }

    if (playerStateMigrationComplete) {
      boot();
    }
  }, [playerStateMigrationComplete, session]);

  return { isReady, migrationError, initialSyncComplete };
};

export { useAppBoot };
