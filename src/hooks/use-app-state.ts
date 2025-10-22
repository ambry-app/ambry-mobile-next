import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useAppState() {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  useEffect(() => {
    const onChange = async (newAppState: AppStateStatus) => {
      console.debug("[AppState] changed to", newAppState);
      setAppState(newAppState);
    };

    const subscription = AppState.addEventListener("change", onChange);

    return () => subscription.remove();
  }, []);

  return appState;
}
