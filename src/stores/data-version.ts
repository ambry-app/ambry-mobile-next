import { create } from "zustand";

interface DataVersionState {
  initialized: boolean;
  libraryDataVersion: number | null;
  playthroughDataVersion: number;
  shelfDataVersion: number;
}

export const initialDataVersionState: DataVersionState = {
  initialized: false,
  libraryDataVersion: null,
  playthroughDataVersion: 0,
  shelfDataVersion: 0,
};

export const useDataVersion = create<DataVersionState>(
  () => initialDataVersionState,
);

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

/**
 * Bump the shelf data version (called when shelf state changes).
 * This triggers re-fetches in components that display shelf data.
 */
export function bumpShelfDataVersion() {
  useDataVersion.setState((state) => ({
    shelfDataVersion: state.shelfDataVersion + 1,
  }));
}
