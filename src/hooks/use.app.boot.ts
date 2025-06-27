import { getServerSyncTimestamps, syncDown } from "@/src/db/sync";
import { useDataVersion } from "@/src/stores/dataVersion";
import { registerBackgroundSyncTask } from "@/src/services/BackgroundSyncService";
import { loadMostRecentMedia, setupPlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { useEffect, useState } from "react";
import migrations from "@/drizzle/migrations";
import { db } from "@/src/db/db";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
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

      if (!lastDownSync) {
        try {
          console.debug("[AppBoot] down sync...");
          await syncDown(session);
          console.debug("[AppBoot] down sync complete");
        } catch (e) {
          console.error("[AppBoot] down sync error", e);
        }
      }

      // try {
      //   console.debug("[AppBoot] setting up trackPlayer...");
      //   await setupPlayer(session);
      //   console.debug("[AppBoot] trackPlayer setup complete");
      // } catch (e) {
      //   console.error("[AppBoot] trackPlayer setup error", e);
      // }

      // try {
      //   console.debug("[AppBoot] loading most recent media...");
      //   await loadMostRecentMedia(session);
      //   console.debug("[AppBoot] most recent media loaded");
      // } catch (e) {
      //   console.error("[AppBoot] most recent media load error", e);
      // }

      try {
        console.debug("[AppBoot] registering background sync task...");
        await registerBackgroundSyncTask();
        console.debug("[AppBoot] background sync task registered");
      } catch (e) {
        console.error("[AppBoot] background sync task registration error", e);
      }

      setIsReady(true);
    }

    if (migrationSuccess) {
      boot();
    }
  }, [migrationSuccess, session, setLibraryDataVersion]);

  return { isReady, migrationError };
};

export { useAppBoot };
