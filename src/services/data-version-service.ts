import { getServerSyncTimestamps } from "@/db/sync-helpers";
import { useDataVersion } from "@/stores/data-version";
import { Session } from "@/types/session";

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
