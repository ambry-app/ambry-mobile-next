import { Session } from "@/src/stores/session";
import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import useSyncedDataQuery from "./use.synced.data.query";

export const fadeInTime = 500;

type SyncedDataQueryParams = Parameters<typeof useSyncedDataQuery>;
type Query = SyncedDataQueryParams[1];
type Deps = SyncedDataQueryParams[2];

/**
 * This hook is a wrapper around useSyncedDataQuery that fades in an opacity
 * value when the query first returns.
 */
export default function useFadeInSyncedDataQuery<T extends Query>(
  session: Session,
  query: T,
  additionalDeps: Deps = [],
) {
  const opacity = useSharedValue(0);
  const { data, updatedAt, error } = useSyncedDataQuery(
    session,
    query,
    additionalDeps,
  );

  useEffect(() => {
    if (updatedAt !== undefined)
      opacity.value = withTiming(1, { duration: fadeInTime });
  }, [opacity, updatedAt]);

  return { data, updatedAt, error, opacity } as const;
}
