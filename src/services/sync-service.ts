import { useCallback, useEffect, useState } from "react";
import { AppStateStatus } from "react-native";

import {
  PlaythroughsSyncSuccess,
  SyncError,
  syncLibrary as syncLibraryDb,
  syncPlaythroughs as syncPlaythroughsDb,
} from "@/db/sync";
import {
  bumpPlaythroughDataVersion,
  setLibraryDataVersion,
} from "@/stores/data-version";
import { getDeviceInfo } from "@/stores/device";
import { forceSignOut, useSession } from "@/stores/session";
import { Session } from "@/types/session";

import { performWalCheckpoint } from "./db-service";

export async function sync(session: Session) {
  return Promise.all([syncLibrary(session), syncPlaythroughs(session)]);
}

export async function syncLibrary(session: Session) {
  const result = await syncLibraryDb(session);

  if (!result.success && result.error === SyncError.AUTH_ERROR) {
    forceSignOut();
  }

  if (result.success && result.result !== "no_changes") {
    const { newDataAsOf } = result.result;
    if (newDataAsOf) {
      // Update global data version store
      setLibraryDataVersion(newDataAsOf);
    }
  }

  return result;
}

export async function syncPlaythroughs(session: Session) {
  const deviceInfo = await getDeviceInfo();
  const result = await syncPlaythroughsDb(session, deviceInfo);

  if (!result.success && result.error === SyncError.AUTH_ERROR) {
    forceSignOut();
  }

  if (result.success && result.result === PlaythroughsSyncSuccess.SYNCED) {
    // Notify UI that playthrough data changed
    bumpPlaythroughDataVersion();
  }

  return result;
}

// =============================================================================
// Sync Hooks
// =============================================================================

/**
 * Periodic sync every 15 minutes while the app is in the foreground.
 */
export function useForegroundSync(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const performSync = async () => {
      if (!session) {
        console.debug("[ForegroundSync] No session available, skipping sync");
        return;
      }

      try {
        await sync(session);

        console.debug("[ForegroundSync] performing WAL checkpoint");
        performWalCheckpoint();

        console.debug("[ForegroundSync] completed successfully");
      } catch (error) {
        console.error("[ForegroundSync] failed:", error);
      }
    };

    if (session && appState === "active") {
      console.debug("[ForegroundSync] starting periodic sync");
      intervalId = setInterval(performSync, 15 * 60 * 1000); // 15 minutes
    }

    return () => {
      if (intervalId) {
        console.debug("[ForegroundSync] clearing periodic sync");
        clearInterval(intervalId);
      }
    };
  }, [session, appState]);
}

/**
 * Hook for pull-to-refresh functionality that triggers a sync.
 */
export function usePullToRefresh(session: Session) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  return { refreshing, onRefresh };
}
