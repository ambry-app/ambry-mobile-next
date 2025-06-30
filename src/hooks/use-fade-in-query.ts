import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect } from "react";
import { useSharedValue, withTiming } from "react-native-reanimated";

export const fadeInTime = 500;

type LiveQueryParams = Parameters<typeof useLiveQuery>;
type Query = LiveQueryParams[0];
type Deps = LiveQueryParams[1];

/**
 * @deprecated This hook is deprecated and will be removed soon.
 * This hook is a wrapper around useLiveQuery that fades in an opacity
 * value when the query first returns.
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
