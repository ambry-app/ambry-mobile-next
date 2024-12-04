import { create } from "zustand";

interface ScreenState {
  screenHeight: number;
  screenWidth: number;
  shortScreen: boolean;
}

export const useScreen = create<ScreenState>()(() => ({
  screenHeight: 0,
  screenWidth: 0,
  shortScreen: false,
}));

export function setDimensions(screenHeight: number, screenWidth: number) {
  const shortScreen = screenHeight / screenWidth < 1.8;
  useScreen.setState({ screenHeight, screenWidth, shortScreen });
}
