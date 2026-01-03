/**
 * Boot Service
 *
 * Handles application boot sequence including migrations, store initialization,
 * and initial sync.
 */

import { useEffect, useState } from "react";

import { registerBackgroundSyncTask } from "@/services/background-sync-service";
import { initializeDataVersion } from "@/services/data-version-service";
import { useDatabaseMigrations } from "@/services/db-service";
import { initializeDownloads } from "@/services/download-service";
import { initializePlayer } from "@/services/playback-controls";
import { initializeSleepTimer } from "@/services/sleep-timer-service";
import { sync } from "@/services/sync-service";
import { initializeDevice } from "@/stores/device";
import { useSession } from "@/stores/session";

/**
 * Hook that handles application boot sequence.
 *
 * Boot sequence:
 * 1. Apply database migrations (schema + data migrations)
 * 2. Check session (exit early if none)
 * 3. Initialize device info
 * 4. Initialize data version store
 * 5. Initialize downloads store
 * 6. Initialize sleep timer store
 * 7. Initial sync if needed
 * 8. Initialize player
 * 9. Register background sync task
 *
 * @returns isReady - true when boot is complete
 * @returns migrationError - Error if migrations failed
 * @returns initialSyncComplete - true when initial sync has finished
 */
export function useAppBoot() {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { success: migrationSuccess, error: migrationError } =
    useDatabaseMigrations();
  const session = useSession((state) => state.session);

  // Boot (after migrations complete, session-dependent initialization)
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

    if (migrationSuccess) {
      boot();
    }
  }, [migrationSuccess, session]);

  return { isReady, migrationError, initialSyncComplete };
}
