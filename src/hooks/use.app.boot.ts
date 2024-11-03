import migrations from "@/drizzle/migrations";
import { db } from "@/src/db/db";
import { syncDown } from "@/src/db/sync";
import { usePlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useEffect, useState } from "react";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const { success: migrateSuccess, error: migrateError } = useMigrations(
    db,
    migrations,
  );
  const session = useSession((_) => _.session);
  const setupPlayer = usePlayer((_) => _.setupPlayer);
  const loadMostRecentMedia = usePlayer((_) => _.loadMostRecentMedia);

  useEffect(() => {
    if (migrateError)
      return console.error("[AppBoot] migration error", migrateError);
    if (!migrateSuccess) return;
    if (!session) return setIsReady(true);

    // TODO: allow sync to fail but continue on to setting up track player
    console.log("[AppBoot] starting...");
    syncDown(session)
      .then(() => console.log("[AppBoot] db sync complete"))
      .then(() => setupPlayer(session))
      .then(() => loadMostRecentMedia(session))
      .then(() => console.log("[AppBoot] trackPlayer setup complete"))
      .catch((e) => console.error("[AppBoot] error", e))
      .finally(() => setIsReady(true));
  }, [loadMostRecentMedia, setupPlayer, migrateSuccess, migrateError, session]);

  return { isReady, migrateError };
};

export { useAppBoot };
