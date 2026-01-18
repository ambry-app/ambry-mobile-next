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
import { initialize as initializeEventRecording } from "@/services/event-recording";
import { initializePlayer } from "@/services/playback-controls";
import { initialize as initializeHeartbeat } from "@/services/position-heartbeat";
import { initialize as initializePreferredPlaybackRate } from "@/services/preferred-playback-rate-service";
import { initialize as initializeSleepTimer } from "@/services/sleep-timer-service";
import { sync } from "@/services/sync-service";
import { initialize as initializeTrackPlayer } from "@/services/track-player-service";
import { initializeDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { logBase } from "@/utils/logger";

const log = logBase.extend("boot-service");

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
 * 7. Initialize preferred playback rate store
 * 8. Initial sync if needed
 * 9. Initialize player
 * 10. Register background sync task
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
        log.debug("No session");
        setIsReady(true);
        return;
      }

      log.info("Starting boot sequence");

      await initializeDevice();
      const { needsInitialSync, needsFullPlaythroughResync } =
        await initializeDataVersion(session);

      if (needsFullPlaythroughResync) {
        log.info("Starting one-time full event resync");
        await sync(session, { fullEventResync: true });
        log.info("One-time full event resync complete");
      } else if (needsInitialSync) {
        log.info("Starting initial sync");
        await sync(session);
        log.info("Initial sync complete");
      }
      setInitialSyncComplete(true);

      await initializeDownloads(session);
      await initializeTrackPlayer();
      await initializePlayer(session);
      await initializeSleepTimer(session);
      await initializePreferredPlaybackRate(session);
      await initializeHeartbeat();
      await initializeEventRecording();

      await registerBackgroundSyncTask();

      log.info("Boot sequence complete");

      setIsReady(true);
    }

    if (migrationSuccess) {
      boot();
    }
  }, [migrationSuccess, session]);

  return { isReady, migrationError, initialSyncComplete };
}
