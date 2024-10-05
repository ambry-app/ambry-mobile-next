import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import { useEffect, useState } from "react";

const useAppInit = () => {
  const [isReady, setIsReady] = useState(false);
  const session = useSessionStore((_) => _.session);
  const setupTrackPlayer = useTrackPlayerStore((_) => _.setupTrackPlayer);
  const loadMostRecentMedia = useTrackPlayerStore((_) => _.loadMostRecentMedia);

  useEffect(() => {
    if (!session?.token) return;

    console.log("app init starting...");
    syncDown(session)
      .then(() => console.log("app init db sync complete"))
      .then(() => setupTrackPlayer())
      .then(() => loadMostRecentMedia(session))
      .catch((e) => console.error("app init error", e))
      .finally(() => setIsReady(true));
  }, [loadMostRecentMedia, setupTrackPlayer, session]);

  return { isReady };
};

export { useAppInit };
