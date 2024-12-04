import { syncDown } from "@/src/db/sync";
import { loadMostRecentMedia, setupPlayer } from "@/src/stores/player";
import { useSession } from "@/src/stores/session";
import { useEffect, useState } from "react";

const useAppBoot = () => {
  const [isReady, setIsReady] = useState(false);
  const session = useSession((state) => state.session);

  useEffect(() => {
    async function boot() {
      if (!session) {
        console.debug("[AppBoot] no session; isReady: true");
        setIsReady(true);
        return;
      }

      try {
        console.debug("[AppBoot] down sync...");
        await syncDown(session);
        console.debug("[AppBoot] down sync complete");
      } catch (e) {
        console.error("[AppBoot] down sync error", e);
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

      setIsReady(true);
    }

    boot();
  }, [session]);

  return { isReady };
};

export { useAppBoot };
