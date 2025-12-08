import { useEffect, useState } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { getExpoSqliteDb } from "@/db/db";
import { syncDown } from "@/db/sync";
import { registerBackgroundSyncTask } from "@/services/background-sync-service";
import { initializeDataVersion } from "@/stores/data-version";
import { initializeDevice } from "@/stores/device";
import { initializeDownloads } from "@/stores/downloads";
import { initializePlayer } from "@/stores/player";
import { useSession } from "@/stores/session";
import { initializeSleepTimer } from "@/stores/sleep-timer";
import migrations from "@drizzle/migrations";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { success: migrationSuccess, error: migrationError } = useMigrations(
    getExpoSqliteDb(),
    migrations,
  );
  const session = useSession((state) => state.session);

  useEffect(() => {
    async function boot() {
      if (!session) {
        console.debug("[AppBoot] No session");
        setIsReady(true);
        return;
      }

      console.debug("[AppBoot] Starting");

      // Initialize stores (each handles its own "already initialized" check)
      await initializeDevice();
      const { needsInitialSync } = await initializeDataVersion(session);
      await initializeDownloads(session);
      await initializeSleepTimer(session);

      // Initial sync if needed
      if (needsInitialSync) {
        try {
          console.debug("[AppBoot] Initial sync...");
          await syncDown(session);
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

    if (migrationSuccess) {
      boot();
    }
  }, [migrationSuccess, session]);

  return { isReady, migrationError, initialSyncComplete };
};

export { useAppBoot };
