import migrations from "@/drizzle/migrations";
import { db, expoDb } from "@/src/db/db";
import { getServerSyncTimestamps, syncDown, syncUp } from "@/src/db/sync";
import { registerBackgroundSyncTask } from "@/src/services/background-sync-service";
import { useDataVersion } from "@/src/stores/data-version";
import { loadMostRecentMedia, setupPlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { loadAllDownloads } from "../stores/downloads";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { success: migrationSuccess, error: migrationError } = useMigrations(
    db,
    migrations,
  );
  const session = useSession((state) => state.session);
  const setLibraryDataVersion = useDataVersion((s) => s.setLibraryDataVersion);

  useEffect(() => {
    async function boot() {
      if (!session) {
        console.debug("[AppBoot] no session; isReady: true");
        setIsReady(true);
        return;
      }

      const { lastDownSync, newDataAsOf } =
        await getServerSyncTimestamps(session);

      if (newDataAsOf) setLibraryDataVersion(newDataAsOf);

      await loadAllDownloads(session);

      if (!lastDownSync) {
        try {
          console.debug("[AppBoot] down sync...");
          await syncDown(session);
          console.debug("[AppBoot] down sync complete");
          setInitialSyncComplete(true);
        } catch (e) {
          console.error("[AppBoot] down sync error", e);
          setInitialSyncComplete(true);
        }
      } else {
        setInitialSyncComplete(true);
      }

      try {
        console.debug("[AppBoot] setting up trackPlayer...");
        await setupPlayer(session);
        console.debug("[AppBoot] trackPlayer setup complete");
      } catch (e) {
        console.error("[AppBoot] trackPlayer setup error", e);
      }

      try {
        console.debug("[AppBoot] loading most recent media...");
        await loadMostRecentMedia(session);
        console.debug("[AppBoot] most recent media loaded");
      } catch (e) {
        console.error("[AppBoot] most recent media load error", e);
      }

      try {
        await registerBackgroundSyncTask();
      } catch (e) {
        console.error("[AppBoot] background sync task registration error", e);
      }

      setIsReady(true);
    }

    if (migrationSuccess) {
      boot();
    }
  }, [migrationSuccess, session, setLibraryDataVersion]);

  // Periodic sync every 15 minutes
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    async function periodicSync() {
      const session = useSession.getState().session;

      if (!session) {
        console.debug("[ForegroundSync] No session available, skipping sync");
        return;
      }

      try {
        await syncDown(session);
        await syncUp(session);
        console.debug("[ForegroundSync] performing WAL checkpoint");
        expoDb.execSync("PRAGMA wal_checkpoint(TRUNCATE);");
        console.debug("[ForegroundSync] completed successfully");
      } catch (error) {
        console.error("[ForegroundSync] failed:", error);
      }
    }

    if (migrationSuccess && session) {
      console.debug("[ForegroundSync] starting periodic sync interval");
      // Start periodic sync every 15 minutes (900,000 ms)
      intervalId = setInterval(periodicSync, 15 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        console.debug("[ForegroundSync] clearing periodic sync interval");
        clearInterval(intervalId);
      }
    };
  }, [migrationSuccess, session]);

  // Handle app state changes to reload data when app resumes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      console.debug("[AppState] changed to", nextAppState);

      if (session && nextAppState === "active") {
        console.debug("[AppState] reloading library data version");
        const { newDataAsOf } = await getServerSyncTimestamps(session);
        if (newDataAsOf) setLibraryDataVersion(newDataAsOf);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [session, setLibraryDataVersion]);

  return { isReady, migrationError, initialSyncComplete };
};

export { useAppBoot };
