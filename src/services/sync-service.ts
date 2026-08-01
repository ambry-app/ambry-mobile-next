import { useCallback, useEffect, useState } from "react";
import { AppStateStatus } from "react-native";

import { FOREGROUND_SYNC_INTERVAL } from "@/constants";
import {
  applyEventSyncResult,
  applyLibraryChanges,
  getEventSyncData,
  getLastLibrarySyncInfo,
  LibraryChangesInput,
} from "@/db/sync";
import { setLastFullPlaythroughSyncTime } from "@/db/sync-helpers";
import {
  DeviceTypeInput,
  getLibraryChangesSince,
  PlaybackEventType,
  syncEvents,
  SyncEventsInput,
} from "@/graphql/api";
import {
  ExecuteAuthenticatedError,
  ExecuteAuthenticatedErrorCode,
} from "@/graphql/client/execute";
import {
  bumpPlaythroughDataVersion,
  setLibraryDataVersion,
} from "@/stores/data-version";
import { getDeviceInfo } from "@/stores/device";
import { clearSession, useSession } from "@/stores/session";
import { DeviceInfo } from "@/types/device-info";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

import { performWalCheckpoint } from "./db-service";

const log = logBase.extend("sync-service");

// =============================================================================
// Error Logging
// =============================================================================

function logGQLError(error: ExecuteAuthenticatedError, context: string) {
  switch (error.code) {
    case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
      log.warn(`${context} unauthorized, signing out...`);
      break;
    case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
      log.error(`${context} network error, we'll try again later`);
      break;
    case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
    case ExecuteAuthenticatedErrorCode.GQL_ERROR:
      log.error(`${context} server error, we'll try again later`);
      break;
  }
}

// =============================================================================
// Library Sync
// =============================================================================

interface SyncLibraryOptions {
  fullResync?: boolean;
}

export async function syncLibrary(
  session: Session,
  options: SyncLibraryOptions = {},
): Promise<void> {
  const { fullResync = false } = options;

  if (fullResync) {
    log.info("Performing full library resync");
  } else {
    log.debug("Syncing library");
  }

  // 1. Get last sync info from DB; a full resync discards the stored cursor
  // so the server sends the entire library again
  const storedSyncInfo = await getLastLibrarySyncInfo(session);
  const syncInfo = fullResync
    ? { ...storedSyncInfo, lastSyncTime: null }
    : storedSyncInfo;

  // 2. Call GraphQL API to get changes
  const result = await getLibraryChangesSince(session, syncInfo.lastSyncTime);

  if (!result.success) {
    logGQLError(result.error, "syncLibrary:");

    if (result.error.code === ExecuteAuthenticatedErrorCode.UNAUTHORIZED) {
      clearSession();
    }
    return;
  }

  const changes = result.result;

  if (!changes) {
    log.info("No library changes to apply");
    return;
  }

  // 3. Apply changes to DB
  const { newDataAsOf } = await applyLibraryChanges(
    session,
    changes as LibraryChangesInput,
    syncInfo,
  );

  // 4. Update global data version store
  if (newDataAsOf) {
    setLibraryDataVersion(newDataAsOf);
  }

  log.debug("Library sync complete");
}

// =============================================================================
// Event Sync (V2 - events only, playthroughs derived)
// =============================================================================

interface SyncPlaybackEventsOptions {
  fullResync?: boolean;
  deviceInfoOverride?: DeviceInfo;
}

// Mapping from local types to GraphQL enums
const deviceTypeMap: Record<string, DeviceTypeInput> = {
  ios: DeviceTypeInput.Ios,
  android: DeviceTypeInput.Android,
};

const eventTypeMap: Record<string, PlaybackEventType> = {
  start: PlaybackEventType.Start,
  play: PlaybackEventType.Play,
  pause: PlaybackEventType.Pause,
  seek: PlaybackEventType.Seek,
  rate_change: PlaybackEventType.RateChange,
  finish: PlaybackEventType.Finish,
  abandon: PlaybackEventType.Abandon,
  resume: PlaybackEventType.Resume,
  delete: PlaybackEventType.Delete,
};

export async function syncPlaybackEvents(
  session: Session,
  options: SyncPlaybackEventsOptions = {},
): Promise<void> {
  const { fullResync = false, deviceInfoOverride } = options;

  if (fullResync) {
    log.info("Performing full event resync");
  } else {
    log.debug("Syncing events (V2)");
  }

  // 1. Get unsynced events from DB
  const deviceInfo = deviceInfoOverride ?? (await getDeviceInfo());
  const syncData = await getEventSyncData(session);

  // 2. Build GraphQL input (events only - no playthroughs)
  const input: SyncEventsInput = {
    lastSyncTime: fullResync ? null : syncData.lastSyncTime,
    device: {
      id: deviceInfo.id,
      type: deviceTypeMap[deviceInfo.type] ?? DeviceTypeInput.Android,
      brand: deviceInfo.brand,
      modelName: deviceInfo.modelName,
      osName: deviceInfo.osName,
      osVersion: deviceInfo.osVersion,
      appId: deviceInfo.appId,
      appVersion: deviceInfo.appVersion,
      appBuild: deviceInfo.appBuild,
    },
    events: syncData.unsyncedEvents.map((e) => ({
      id: e.id,
      playthroughId: e.playthroughId,
      mediaId: e.mediaId,
      type: eventTypeMap[e.type] ?? PlaybackEventType.Play,
      timestamp: e.timestamp,
      position: e.position,
      playbackRate: e.playbackRate,
      fromPosition: e.fromPosition,
      toPosition: e.toPosition,
      previousRate: e.previousRate,
    })),
  };

  // 3. Call GraphQL API
  const result = await syncEvents(session, input);

  if (!result.success) {
    logGQLError(result.error, "syncPlaythroughs:");
    if (result.error.code === ExecuteAuthenticatedErrorCode.UNAUTHORIZED) {
      clearSession();
    }
    return;
  }

  const syncResult = result.result.syncEvents;
  if (!syncResult) {
    log.info("No event sync result returned");
    return;
  }

  // 4. Apply result to DB (events only, rebuild affected playthroughs)
  await applyEventSyncResult(
    session,
    syncResult,
    syncData.unsyncedEvents.map((e) => e.id),
  );

  // 5. If this was a full resync, update the timestamp
  if (fullResync) {
    await setLastFullPlaythroughSyncTime(session, new Date());
  }

  // 6. Notify UI that playthrough data changed
  bumpPlaythroughDataVersion();

  log.debug("Event sync complete");
  return;
}

// =============================================================================
// Combined Sync
// =============================================================================

interface SyncOptions {
  fullEventResync?: boolean;
  fullLibraryResync?: boolean;
}

export async function sync(session: Session, options: SyncOptions = {}) {
  const { fullEventResync = false, fullLibraryResync = false } = options;
  return Promise.all([
    syncLibrary(session, { fullResync: fullLibraryResync }),
    syncPlaybackEvents(session, { fullResync: fullEventResync }),
  ]);
}

// =============================================================================
// Sync Hooks
// =============================================================================

/**
 * Syncs immediately whenever the app becomes active, then every 15 minutes
 * while it stays in the foreground.
 */
export function useForegroundSync(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const performSync = async () => {
      if (!session) {
        log.debug("ForegroundSync: No session available, skipping sync");
        return;
      }

      try {
        await sync(session);

        log.debug("ForegroundSync: performing WAL checkpoint");
        performWalCheckpoint();

        log.info("ForegroundSync: completed successfully");
      } catch (error) {
        log.error("ForegroundSync: failed:", error);
      }
    };

    if (session && appState === "active") {
      log.debug("ForegroundSync: syncing now and starting periodic sync");
      performSync();
      intervalId = setInterval(performSync, FOREGROUND_SYNC_INTERVAL);
    }

    return () => {
      if (intervalId) {
        log.debug("ForegroundSync: clearing periodic sync");
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
      log.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  return { refreshing, onRefresh };
}
