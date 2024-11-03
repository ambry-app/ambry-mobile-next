import { create } from "zustand";

interface ScreenState {
  screenHeight: number;
  screenWidth: number;
}

export const useScreen = create<ScreenState>()(() => ({
  screenHeight: 0,
  screenWidth: 0,
}));

export function setDimensions(screenHeight: number, screenWidth: number) {
  useScreen.setState({ screenHeight, screenWidth });
}
