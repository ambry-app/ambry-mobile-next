import { type AnySQLiteSelect } from "drizzle-orm/sqlite-core";
import { SQLiteRelationalQuery } from "drizzle-orm/sqlite-core/query-builders/query";
import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { useLiveTablesQuery } from "./use.live.tables.query";

export const fadeInTime = 500;

/**
 * This hook is a wrapper around useLiveTablesQuery that fades in an opacity
 * value when the query first returns.
 */
export default function useFadeInQuery<
  T extends
    | Pick<AnySQLiteSelect, "_" | "then">
    | SQLiteRelationalQuery<"sync", unknown>,
>(query: T, tables: string[], deps: unknown[] = []) {
  const opacity = useSharedValue(0);
  const { data, updatedAt, error } = useLiveTablesQuery(query, tables, deps);

  useEffect(() => {
    if (updatedAt !== undefined)
      opacity.value = withTiming(1, { duration: fadeInTime });
  }, [opacity, updatedAt]);

  return { data, updatedAt, error, opacity } as const;
}
