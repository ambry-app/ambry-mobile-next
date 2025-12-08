import { useEffect } from "react";
import { AppStateStatus } from "react-native";

import { getExpoDb } from "@/db/db";
import { syncDown, syncPlaythroughs, syncUp } from "@/db/sync";
import { useSession } from "@/stores/session";

// Periodic sync every 15 minutes while the app is in the foreground.
export function useForegroundSync(appState: AppStateStatus) {
  const session = useSession((state) => state.session);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const performSync = async () => {
      if (!session) {
        console.debug("[ForegroundSync] No session available, skipping sync");
        return;
      }

      try {
        await syncDown(session);
        await syncUp(session);
        await syncPlaythroughs(session);

        console.debug("[ForegroundSync] performing WAL checkpoint");
        getExpoDb().execSync("PRAGMA wal_checkpoint(TRUNCATE);");

        console.debug("[ForegroundSync] completed successfully");
      } catch (error) {
        console.error("[ForegroundSync] failed:", error);
      }
    };

    if (session && appState === "active") {
      console.debug("[ForegroundSync] starting periodic sync");
      intervalId = setInterval(performSync, 15 * 60 * 1000); // 15 minutes
    }

    return () => {
      if (intervalId) {
        console.debug("[ForegroundSync] clearing periodic sync");
        clearInterval(intervalId);
      }
    };
  }, [session, appState]);
}
