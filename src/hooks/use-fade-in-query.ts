import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

export const fadeInTime = 500;

/**
 * @deprecated
 */
type LiveQueryParams = Parameters<typeof useLiveQuery>;

/**
 * @deprecated
 */
type Query = LiveQueryParams[0];

/**
 * @deprecated
 */
type Deps = LiveQueryParams[1];

/**
 * @deprecated
 */
export default function useFadeInQuery<T extends Query>(
  query: T,
  deps: Deps = [],
) {
  const opacity = useSharedValue(0);
  const { data, updatedAt, error } = useLiveQuery(query, deps);

  useEffect(() => {
    if (updatedAt !== undefined)
      opacity.value = withTiming(1, { duration: fadeInTime });
  }, [opacity, updatedAt]);

  return { data, updatedAt, error, opacity } as const;
}
