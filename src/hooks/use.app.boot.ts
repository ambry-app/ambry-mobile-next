import migrations from "@/drizzle/migrations";
import { db } from "@/src/db/db";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const { success: migrateSuccess, error: migrateError } = useMigrations(
    db,
    migrations,
  );
  const session = useSessionStore((_) => _.session);
  const setupTrackPlayer = useTrackPlayerStore((_) => _.setupTrackPlayer);
  const loadMostRecentMedia = useTrackPlayerStore((_) => _.loadMostRecentMedia);

  useEffect(() => {
    if (migrateError)
      return console.error("[AppBoot] migration error", migrateError);
    if (!migrateSuccess) return;
    if (!session) return setIsReady(true);

    // TODO: allow sync to fail but continue on to setting up track player
    console.log("[AppBoot] starting...");
    syncDown(session)
      .then(() => console.log("[AppBoot] db sync complete"))
      .then(() => setupTrackPlayer())
      .then(() => loadMostRecentMedia(session))
      .then(() => console.log("[AppBoot] trackPlayer setup complete"))
      .catch((e) => console.error("[AppBoot] error", e))
      .finally(() => setIsReady(true));
  }, [
    loadMostRecentMedia,
    setupTrackPlayer,
    migrateSuccess,
    migrateError,
    session,
  ]);

  return { isReady, migrateError };
};

export { useAppBoot };
