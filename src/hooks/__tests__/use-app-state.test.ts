import { AppState, AppStateStatus } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { useAppState } from "@/hooks/use-app-state";

// Mock AppState
const listeners: ((state: AppStateStatus) => void)[] = [];

jest.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, cb: (state: AppStateStatus) => void) => {
      listeners.push(cb);
      return {
        remove: () => {
          const idx = listeners.indexOf(cb);
          if (idx !== -1) listeners.splice(idx, 1);
        },
      };
    },
  },
}));

describe("useAppState", () => {
  beforeEach(() => {
    listeners.length = 0;
    (AppState as any).currentState = "active";
  });

  it("returns the initial app state", () => {
    (AppState as any).currentState = "background";
    const { result } = renderHook(() => useAppState());
    expect(result.current).toBe("background");
  });

  it("updates state when AppState changes", () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current).toBe("active");
    act(() => {
      listeners.forEach((cb) => cb("background"));
    });
    expect(result.current).toBe("background");
    act(() => {
      listeners.forEach((cb) => cb("inactive"));
    });
    expect(result.current).toBe("inactive");
  });

  it("cleans up the event listener on unmount", () => {
    const { unmount } = renderHook(() => useAppState());
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
