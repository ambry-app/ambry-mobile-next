import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function useSyncOnFocus() {
  const session = useSessionStore((state) => state.session);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;

      // sync in background
      // if network is down, we just ignore the error
      syncDown(session).catch((error) => {
        console.error("sync error:", error);
      });
    }, [session]),
  );
}
