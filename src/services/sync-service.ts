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
import {
  beginSyncProgress,
  setSyncSaveProgress,
  setSyncStage,
  SyncStage,
  SyncTask,
} from "@/stores/sync-progress";
import { DeviceInfo } from "@/types/device-info";
import { Result } from "@/types/result";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

import { performWalCheckpoint } from "./db-service";

const log = logBase.extend("sync-service");

// =============================================================================
// Errors
// =============================================================================

export enum SyncErrorCode {
  /** The session is no longer valid; it has been cleared. */
  UNAUTHORIZED = "SyncErrorUnauthorized",
  /** The server could not be reached. */
  NETWORK = "SyncErrorNetwork",
  /** The server was reached but refused or failed the request. */
  SERVER = "SyncErrorServer",
  /** Anything else - a thrown exception, usually from the database. */
  UNEXPECTED = "SyncErrorUnexpected",
}

export interface SyncError {
  code: SyncErrorCode;
  cause?: unknown;
}

/**
 * A sync either applied cleanly or it did not. Callers get the failure back
 * rather than an exception, so they can decide whether to surface it (initial
 * sync) or quietly try again later (periodic sync).
 */
export type SyncOutcome = Result<void, SyncError>;

const SYNC_OK: SyncOutcome = { success: true, result: undefined };

function syncFailure(code: SyncErrorCode, cause?: unknown): SyncOutcome {
  return { success: false, error: { code, cause } };
}

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

/**
 * Translate a GraphQL failure into a sync failure, clearing the session if the
 * server no longer accepts our token.
 */
function handleGQLError(
  error: ExecuteAuthenticatedError,
  context: string,
): SyncOutcome {
  logGQLError(error, context);

  switch (error.code) {
    case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
      clearSession();
      return syncFailure(SyncErrorCode.UNAUTHORIZED);
    case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
      return syncFailure(SyncErrorCode.NETWORK);
    case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
    case ExecuteAuthenticatedErrorCode.GQL_ERROR:
      return syncFailure(SyncErrorCode.SERVER);
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
): Promise<SyncOutcome> {
  const { fullResync = false } = options;

  if (fullResync) {
    log.info("Performing full library resync");
  } else {
    log.debug("Syncing library");
  }

  try {
    // 1. Get last sync info from DB. A full fetch asks for every entity, but
    // still asks for deletions from the stored cursor: the server answers
    // "none" to a null deletions cursor, which is right for a client holding
    // nothing and wrong for one re-fetching a library it already has.
    const storedSyncInfo = await getLastLibrarySyncInfo(session);
    const fullFetch = fullResync || storedSyncInfo.needsFullRefetch;
    const syncInfo = fullFetch
      ? { ...storedSyncInfo, lastSyncTime: null }
      : storedSyncInfo;

    if (storedSyncInfo.needsFullRefetch) {
      log.info("Schema change asked for a full re-fetch");
    }

    // 2. Call GraphQL API to get changes
    setSyncStage(SyncTask.LIBRARY, SyncStage.DOWNLOADING);
    const result = await getLibraryChangesSince(
      session,
      syncInfo.lastSyncTime,
      storedSyncInfo.lastSyncTime,
    );

    if (!result.success) {
      setSyncStage(SyncTask.LIBRARY, SyncStage.FAILED);
      return handleGQLError(result.error, "syncLibrary:");
    }

    const changes = result.result;

    if (!changes) {
      log.info("No library changes to apply");
      setSyncStage(SyncTask.LIBRARY, SyncStage.DONE);
      return SYNC_OK;
    }

    // 3. Apply changes to DB
    const { newDataAsOf } = await applyLibraryChanges(
      session,
      changes as LibraryChangesInput,
      syncInfo,
      ({ detail, current, total }) =>
        setSyncSaveProgress(SyncTask.LIBRARY, detail, current, total),
    );

    // 4. Update global data version store
    if (newDataAsOf) {
      setLibraryDataVersion(newDataAsOf);
    }

    log.debug("Library sync complete");
    setSyncStage(SyncTask.LIBRARY, SyncStage.DONE);
    return SYNC_OK;
  } catch (error) {
    log.error("syncLibrary: unexpected failure", error);
    setSyncStage(SyncTask.LIBRARY, SyncStage.FAILED);
    return syncFailure(SyncErrorCode.UNEXPECTED, error);
  }
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
): Promise<SyncOutcome> {
  const { fullResync = false, deviceInfoOverride } = options;

  if (fullResync) {
    log.info("Performing full event resync");
  } else {
    log.debug("Syncing events (V2)");
  }

  try {
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
    setSyncStage(SyncTask.EVENTS, SyncStage.DOWNLOADING);
    const result = await syncEvents(session, input);

    if (!result.success) {
      setSyncStage(SyncTask.EVENTS, SyncStage.FAILED);
      return handleGQLError(result.error, "syncPlaythroughs:");
    }

    const syncResult = result.result.syncEvents;
    if (!syncResult) {
      log.info("No event sync result returned");
      setSyncStage(SyncTask.EVENTS, SyncStage.DONE);
      return SYNC_OK;
    }

    // 4. Apply result to DB (events only, rebuild affected playthroughs)
    await applyEventSyncResult(
      session,
      syncResult,
      syncData.unsyncedEvents.map((e) => e.id),
      ({ detail, current, total }) =>
        setSyncSaveProgress(SyncTask.EVENTS, detail, current, total),
    );

    // 5. If this was a full resync, update the timestamp
    if (fullResync) {
      await setLastFullPlaythroughSyncTime(session, new Date());
    }

    // 6. Notify UI that playthrough data changed
    bumpPlaythroughDataVersion();

    log.debug("Event sync complete");
    setSyncStage(SyncTask.EVENTS, SyncStage.DONE);
    return SYNC_OK;
  } catch (error) {
    log.error("syncPlaybackEvents: unexpected failure", error);
    setSyncStage(SyncTask.EVENTS, SyncStage.FAILED);
    return syncFailure(SyncErrorCode.UNEXPECTED, error);
  }
}

// =============================================================================
// Combined Sync
// =============================================================================

interface SyncOptions {
  fullEventResync?: boolean;
  fullLibraryResync?: boolean;
}

/**
 * The library and event syncs are independent, so each reports its own outcome
 * and one failing does not hide the other's result.
 */
export interface SyncResults {
  library: SyncOutcome;
  events: SyncOutcome;
}

/** The first failure across both halves of a sync, if either failed. */
export function firstSyncError(results: SyncResults): SyncError | null {
  if (!results.library.success) return results.library.error;
  if (!results.events.success) return results.events.error;
  return null;
}

export async function sync(
  session: Session,
  options: SyncOptions = {},
): Promise<SyncResults> {
  const { fullEventResync = false, fullLibraryResync = false } = options;

  beginSyncProgress();

  const [library, events] = await Promise.all([
    syncLibrary(session, { fullResync: fullLibraryResync }),
    syncPlaybackEvents(session, { fullResync: fullEventResync }),
  ]);

  return { library, events };
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

      const error = firstSyncError(await sync(session));

      log.debug("ForegroundSync: performing WAL checkpoint");
      performWalCheckpoint();

      if (error) {
        log.error("ForegroundSync: failed:", error.code);
      } else {
        log.info("ForegroundSync: completed successfully");
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
    const error = firstSyncError(await sync(session));
    if (error) log.error("Pull-to-refresh sync error:", error.code);
    setRefreshing(false);
  }, [session]);

  return { refreshing, onRefresh };
}
