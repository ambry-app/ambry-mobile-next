/**
 * Boot Service
 *
 * Handles application boot sequence including migrations, store initialization,
 * and initial sync.
 */

import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Sentry from "@sentry/react-native";

import { registerBackgroundSyncTask } from "@/services/background-sync-service";
import { initializeDataVersion } from "@/services/data-version-service";
import { useDatabaseMigrations } from "@/services/db-service";
import { initializeDownloads } from "@/services/download-service";
import { initialize as initializeEventRecording } from "@/services/event-recording";
import { initializePlayer } from "@/services/playback-controls";
import { initPlaybackService } from "@/services/playback-service";
import { initialize as initializeHeartbeat } from "@/services/position-heartbeat";
import { initialize as initializePreferredPlaybackRate } from "@/services/preferred-playback-rate-service";
import { initialize as initializeSleepTimer } from "@/services/sleep-timer-service";
import {
  firstSyncError,
  sync,
  SyncError,
  SyncErrorCode,
} from "@/services/sync-service";
import { initialize as initializeTrackPlayer } from "@/services/track-player-service";
import { initializeDevice } from "@/stores/device";
import {
  reloadSession,
  sessionKeychainError,
  useSession,
} from "@/stores/session";
import { isKeychainLocked } from "@/utils/keychain";
import { logBase } from "@/utils/logger";

const log = logBase.extend("boot-service");

/**
 * Why the app could not finish booting. Everything the boot sequence does is
 * either talking to the server or talking to the database, so these are the
 * only distinctions worth making to the user.
 */
export enum BootErrorKind {
  /** The server could not be reached. */
  NETWORK = "BootErrorNetwork",
  /** The server was reached but the request failed. */
  SERVER = "BootErrorServer",
  /** Something else went wrong - most likely the local database. */
  UNEXPECTED = "BootErrorUnexpected",
}

export interface BootError {
  kind: BootErrorKind;
  cause?: unknown;
}

/**
 * An unauthorized sync clears the session, which sends the user back to the
 * sign-in screen on its own - there is nothing to show an error about.
 */
function bootErrorFromSync(error: SyncError): BootError | null {
  switch (error.code) {
    case SyncErrorCode.UNAUTHORIZED:
      return null;
    case SyncErrorCode.NETWORK:
      return { kind: BootErrorKind.NETWORK };
    case SyncErrorCode.SERVER:
      return { kind: BootErrorKind.SERVER };
    case SyncErrorCode.UNEXPECTED:
      return { kind: BootErrorKind.UNEXPECTED, cause: error.cause };
  }
}

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
 * A boot that fails part-way leaves the app with nothing usable to show, so
 * failures are surfaced as `bootError` and the whole sequence can be retried
 * via `retryBoot` rather than leaving the user on a spinner forever.
 *
 * A locked keychain during a background launch is not a failure: boot waits
 * and starts over the next time the app comes to the foreground.
 *
 * @returns isReady - true when boot is complete
 * @returns migrationError - Error if migrations failed
 * @returns initialSyncComplete - true when initial sync has finished
 * @returns bootError - why boot failed, if it did
 * @returns retryBoot - runs the boot sequence again
 */
export function useAppBoot() {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const [bootError, setBootError] = useState<BootError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [keychainLocked, setKeychainLocked] = useState(false);
  const { success: migrationSuccess, error: migrationError } =
    useDatabaseMigrations();
  const session = useSession((state) => state.session);

  const retryBoot = useCallback(() => {
    log.info("Retrying boot sequence");
    setBootError(null);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!keychainLocked) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;

      log.info("Retrying boot in the foreground");
      setKeychainLocked(false);
      setAttempt((current) => current + 1);
    });

    return () => subscription.remove();
  }, [keychainLocked]);

  // Boot (after migrations complete, session-dependent initialization)
  useEffect(() => {
    async function boot() {
      if (sessionKeychainError()) {
        reloadSession();
        // A session that loads re-runs boot on its own
        if (useSession.getState().session !== session) return;
        const error = sessionKeychainError();
        if (error) throw error;
      }

      if (!session) {
        log.debug("No session");
        setIsReady(true);
        return;
      }

      log.info("Starting boot sequence");

      await initializeDevice();
      const { needsInitialSync, needsFullPlaythroughResync } =
        await initializeDataVersion(session);

      // The initial sync is the app's only source of library data, so unlike a
      // periodic sync its failure has to stop the boot and be reported.
      if (needsFullPlaythroughResync || needsInitialSync) {
        const fullEventResync = needsFullPlaythroughResync;
        log.info(
          fullEventResync
            ? "Starting one-time full event resync"
            : "Starting initial sync",
        );

        const error = firstSyncError(await sync(session, { fullEventResync }));

        if (error) {
          log.error("Initial sync failed:", error.code);
          setBootError(bootErrorFromSync(error));
          setIsReady(true);
          return;
        }

        log.info("Initial sync complete");
      }
      setInitialSyncComplete(true);

      await initializeDownloads(session);
      initPlaybackService();
      await initializeTrackPlayer();
      await initializePlayer(session);
      await initializeSleepTimer();
      await initializePreferredPlaybackRate();
      await initializeHeartbeat();
      await initializeEventRecording();

      await registerBackgroundSyncTask();

      log.info("Boot sequence complete");

      setIsReady(true);
    }

    if (migrationSuccess) {
      boot().catch((error) => {
        if (isKeychainLocked(error) && AppState.currentState !== "active") {
          log.info("Keychain locked, waiting for the foreground");
          setKeychainLocked(true);
          return;
        }

        log.error("Boot sequence failed:", error);
        Sentry.captureException(error);
        setBootError({ kind: BootErrorKind.UNEXPECTED, cause: error });
        setIsReady(true);
      });
    }
  }, [migrationSuccess, session, attempt]);

  return { isReady, migrationError, initialSyncComplete, bootError, retryBoot };
}
