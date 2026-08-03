import { useEffect } from "react";
import { AppStateStatus } from "react-native";

import {
  getServerProfileSyncTimestamps,
  getServerSyncTimestamps,
} from "@/db/sync-helpers";
import { setLibraryDataVersion, useDataVersion } from "@/stores/data-version";
import { useSession } from "@/stores/session";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

const log = logBase.extend("data-version");

/**
 * Gets the library data version (last sync timestamp) for a session.
 * Used to detect if background sync has updated data while app was backgrounded.
 */
export async function getLibraryDataVersion(
  session: Session,
): Promise<Date | null> {
  const { libraryDataVersion } = await getServerSyncTimestamps(session);
  return libraryDataVersion;
}

/**
 * Initialize the data version store.
 * Loads sync timestamps from DB if not already initialized.
 * Returns whether initial sync is needed (for use by app boot).
 *
 * The "needs sync" answers always come from the stored timestamps rather than
 * the store's `initialized` flag: those timestamps are only written once a sync
 * has actually applied, so a boot that is retried after a failed initial sync
 * still knows the sync is outstanding.
 */
export async function initializeDataVersion(
  session: Session,
): Promise<{ needsInitialSync: boolean; needsFullPlaythroughResync: boolean }> {
  const [
    { lastSyncTime: lastLibrarySyncTime, libraryDataVersion },
    { lastFullPlaythroughSyncTime },
  ] = await Promise.all([
    getServerSyncTimestamps(session),
    getServerProfileSyncTimestamps(session),
  ]);

  if (useDataVersion.getState().initialized) {
    log.debug("Store already initialized, leaving data version as-is");
  } else {
    log.debug("Initializing");

    useDataVersion.setState({
      initialized: true,
      libraryDataVersion: libraryDataVersion?.getTime() ?? null,
    });
  }

  return {
    needsInitialSync: lastLibrarySyncTime === null,
    needsFullPlaythroughResync: lastFullPlaythroughSyncTime === null,
  };
}

// =============================================================================
// Data Version Hooks
// =============================================================================

/**
 * Reloads the library data version when the app state changes to "active",
 * in case a background sync has occurred while the app was in the background.
 */
export function useRefreshLibraryDataVersion(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    const run = async () => {
      if (session && appState === "active") {
        log.debug("Reloading library data version on app state change");
        const libraryDataVersion = await getLibraryDataVersion(session);
        if (libraryDataVersion) setLibraryDataVersion(libraryDataVersion);
      }
    };

    run();
  }, [session, appState]);

  return appState;
}
