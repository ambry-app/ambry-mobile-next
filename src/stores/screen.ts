import { create } from "zustand";

interface ScreenState {
  height: number;
  width: number;
  setDimensions: (height: number, width: number) => void;
}

export const useScreenStore = create<ScreenState>()((set, get) => ({
  height: 0,
  width: 0,
  setDimensions: (height: number, width: number) => set({ height, width }),
}));
