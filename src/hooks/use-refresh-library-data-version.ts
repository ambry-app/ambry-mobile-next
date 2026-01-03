import { useEffect } from "react";
import { AppStateStatus } from "react-native";

import { getLibraryDataVersion } from "@/services/data-version-service";
import { setLibraryDataVersion } from "@/stores/data-version";
import { useSession } from "@/stores/session";

// Reloads the library data version when the app state changes to "active", in
// case a background sync has occurred while the app was in the background.
export function useRefreshLibraryDataVersion(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    const run = async () => {
      if (session && appState === "active") {
        console.debug("[AppState] reloading library data version");
        const libraryDataVersion = await getLibraryDataVersion(session);
        if (libraryDataVersion) setLibraryDataVersion(libraryDataVersion);
      }
    };

    run();
  }, [session, appState]);

  return appState;
}
