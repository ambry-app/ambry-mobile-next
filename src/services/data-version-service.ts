import { useEffect } from "react";
import { AppStateStatus } from "react-native";

import { getServerSyncTimestamps } from "@/db/sync-helpers";
import { setLibraryDataVersion, useDataVersion } from "@/stores/data-version";
import { useSession } from "@/stores/session";
import { Session } from "@/types/session";

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
 */
export async function initializeDataVersion(
  session: Session,
): Promise<{ needsInitialSync: boolean }> {
  if (useDataVersion.getState().initialized) {
    console.debug("[DataVersion] Already initialized, skipping");
    return { needsInitialSync: false }; // Already synced if we're initialized
  }

  console.debug("[DataVersion] Initializing");

  const { lastSyncTime, libraryDataVersion } =
    await getServerSyncTimestamps(session);

  useDataVersion.setState({
    initialized: true,
    libraryDataVersion: libraryDataVersion?.getTime() ?? null,
  });

  return { needsInitialSync: lastSyncTime === null };
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
        console.debug("[AppState] reloading library data version");
        const libraryDataVersion = await getLibraryDataVersion(session);
        if (libraryDataVersion) setLibraryDataVersion(libraryDataVersion);
      }
    };

    run();
  }, [session, appState]);

  return appState;
}
