import { syncDown } from "@/src/db/sync";
import { Session } from "@/src/stores/session";
import { useCallback, useState } from "react";

export function usePullToRefresh(session: Session) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  return { refreshing, onRefresh };
}
