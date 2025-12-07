/**
 * Group items by a key and optionally transform each item.
 * Like `groupBy` but with an optional map function applied to each item.
 *
 * @example
 * const users = [{ name: "Alice", dept: "Eng" }, { name: "Bob", dept: "Eng" }];
 * groupMapBy(users, u => u.dept);
 * // { Eng: [{ name: "Alice", dept: "Eng" }, { name: "Bob", dept: "Eng" }] }
 *
 * groupMapBy(users, u => u.dept, u => u.name);
 * // { Eng: ["Alice", "Bob"] }
 */
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
