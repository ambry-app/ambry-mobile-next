export function groupMapBy<T, K extends string | number | symbol, R = T>(
  items: T[],
  groupFn: (item: T) => K,
  mapFn?: (item: T) => R,
): Record<K, R[]> {
  return items.reduce(
    (acc, item) => {
      const key = groupFn(item);
      const value = mapFn ? mapFn(item) : (item as unknown as R);
      (acc[key] ||= []).push(value);
      return acc;
    },
    {} as Record<K, R[]>,
  );
}
