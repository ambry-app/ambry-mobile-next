import { create } from "zustand";

import { getServerSyncTimestamps } from "@/db/sync-helpers";

import { Session } from "./session";

interface DataVersionState {
  initialized: boolean;
  libraryDataVersion: number | null;
  playthroughDataVersion: number;
}

export const initialDataVersionState: DataVersionState = {
  initialized: false,
  libraryDataVersion: null,
  playthroughDataVersion: 0,
};

export const useDataVersion = create<DataVersionState>(
  () => initialDataVersionState,
);

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

/**
 * Bump the playthrough data version (called when local playthrough state changes).
 * This triggers re-fetches in components that display playthrough data.
 */
export function bumpPlaythroughDataVersion() {
  useDataVersion.setState((state) => ({
    playthroughDataVersion: state.playthroughDataVersion + 1,
  }));
}
