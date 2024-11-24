import { syncDownLibrary } from "@/src/db/sync";
import { useSession } from "@/src/stores/session";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function useSyncOnFocus() {
  const session = useSession((state) => state.session);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;

      // sync in background
      // if network is down, we just ignore the error
      syncDownLibrary(session).catch((error) => {
        console.warn("[useSyncOnFocus] sync error:", error);
      });
    }, [session]),
  );
}
