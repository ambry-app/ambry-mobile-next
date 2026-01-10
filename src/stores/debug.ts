import { create } from "zustand";

type DebugState = {
  debugModeEnabled: boolean;
  setDebugModeEnabled: (enabled: boolean) => void;
};

export const useDebug = create<DebugState>((set) => ({
  debugModeEnabled: false,
  setDebugModeEnabled: (enabled) => set({ debugModeEnabled: enabled }),
}));
