import migrations from "@/drizzle/migrations";
import { db } from "@/src/db/db";
import { getServerSyncTimestamps, syncDown } from "@/src/db/sync";
import { registerBackgroundSyncTask } from "@/src/services/background-sync-service";
import { getDeviceId } from "@/src/services/device-service";
import { setLibraryDataVersion } from "@/src/stores/data-version";
import { loadMostRecentMedia, setupPlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";
import { loadAllDownloads } from "../stores/downloads";
import { loadSleepTimerSettings } from "../stores/sleep-timer";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { success: migrationSuccess, error: migrationError } = useMigrations(
    db,
    migrations,
  );
  const session = useSession((state) => state.session);

  useEffect(() => {
    async function boot() {
      if (!session) {
        console.debug("[AppBoot] no session; isReady: true");
        setIsReady(true);
        return;
      }

      // Initialize device ID early (needed for event recording)
      await getDeviceId();

      const { lastDownSync, newDataAsOf } =
        await getServerSyncTimestamps(session);

      if (newDataAsOf) setLibraryDataVersion(newDataAsOf);

      await loadAllDownloads(session);
      await loadSleepTimerSettings(session);

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
  }, [migrationSuccess, session]);

  return { isReady, migrationError, initialSyncComplete };
};

export { useAppBoot };
