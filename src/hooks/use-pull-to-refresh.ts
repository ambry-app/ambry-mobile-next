import { useCallback, useState } from "react";

import { syncDown, syncPlaythroughs } from "@/db/sync";
import { Session } from "@/stores/session";

export function usePullToRefresh(session: Session) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
      await syncPlaythroughs(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  return { refreshing, onRefresh };
}
