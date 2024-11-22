import { Session } from "@/src/stores/session";
import { AnySQLiteSelect } from "drizzle-orm/sqlite-core";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import useSyncedDataQuery from "./use.synced.data.query";

export const fadeInTime = 500;

/**
 * This hook is a wrapper around useSyncedDataQuery that fades in an opacity
 * value when the query first returns.
 */
export default function useFadeInSyncedDataQuery<
  T extends
    | Pick<AnySQLiteSelect, "_" | "then">
    | SQLiteRelationalQuery<"sync", unknown>,
>(session: Session, query: T, additionalDeps: unknown[] = []) {
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
