import { create } from "zustand";

interface DataVersionState {
  libraryDataVersion: number | null; // Unix ms timestamp
  setLibraryDataVersion: (version: Date) => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  libraryDataVersion: null,
  setLibraryDataVersion: (date) => set({ libraryDataVersion: date.getTime() }),
}));
