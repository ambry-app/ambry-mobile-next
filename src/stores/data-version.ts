import { create } from "zustand";

interface DataVersionState {
  libraryDataVersion: number | null;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  libraryDataVersion: null,
}));

export function setLibraryDataVersion(date: Date) {
  useDataVersion.setState({ libraryDataVersion: date.getTime() });
}
