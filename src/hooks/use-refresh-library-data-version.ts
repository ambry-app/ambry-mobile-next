import { getServerSyncTimestamps } from "@/src/db/sync";
import { setLibraryDataVersion } from "@/src/stores/data-version";
import { useSession } from "@/src/stores/session";
import { useEffect } from "react";
import { AppStateStatus } from "react-native";

// Reloads the library data version when the app state changes to "active", in
// case a background sync has occurred while the app was in the background.
export function useRefreshLibraryDataVersion(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    const run = async () => {
      if (session && appState === "active") {
        console.debug("[AppState] reloading library data version");
        const { newDataAsOf } = await getServerSyncTimestamps(session);
        if (newDataAsOf) setLibraryDataVersion(newDataAsOf);
      }
    };

    run();
  }, [session, appState]);

  return appState;
}
