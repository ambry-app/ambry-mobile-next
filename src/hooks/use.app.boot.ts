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
    if (!session?.token) return setIsReady(true);
    if (!migrateSuccess) return;
    if (migrateError)
      return console.error("[AppInit] migration error", migrateError);

    console.log("[AppInit] starting...");
    syncDown(session)
      .then(() => console.log("[AppInit] db sync complete"))
      .then(() => setupTrackPlayer())
      .then(() => loadMostRecentMedia(session))
      .then(() => console.log("[AppInit] trackPlayer setup complete"))
      .catch((e) => console.error("[AppInit] error", e))
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
