import { create } from "zustand";

interface ScreenState {
  screenHeight: number;
  screenWidth: number;
  setDimensions: (screenHeight: number, screenWidth: number) => void;
}

export const useScreen = create<ScreenState>()((set, get) => ({
  screenHeight: 0,
  screenWidth: 0,
  setDimensions: (screenHeight: number, screenWidth: number) =>
    set({ screenHeight, screenWidth }),
}));
