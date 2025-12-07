import { getServerSyncTimestamps } from "@/src/db/sync";
import { create } from "zustand";
import { Session } from "./session";

interface DataVersionState {
  initialized: boolean;
  libraryDataVersion: number | null;
}

export const useDataVersion = create<DataVersionState>(() => ({
  initialized: false,
  libraryDataVersion: null,
}));

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

  const { lastDownSync, newDataAsOf } = await getServerSyncTimestamps(session);

  useDataVersion.setState({
    initialized: true,
    libraryDataVersion: newDataAsOf?.getTime() ?? null,
  });

  return { needsInitialSync: lastDownSync === null };
}

/**
 * Update the library data version (called after sync completes).
 */
export function setLibraryDataVersion(date: Date) {
  useDataVersion.setState({ libraryDataVersion: date.getTime() });
}
