/**
 * Flatten a grouped object into an array, applying a callback to each item.
 * The callback receives both the item and its group key.
 *
 * @example
 * const grouped = { fruits: ["apple"], veggies: ["carrot"] };
 * flatMapGroups(grouped, (item, group) => ({ item, group }));
 * // [{ item: "apple", group: "fruits" }, { item: "carrot", group: "veggies" }]
 */
export function flatMapGroups<T, R>(
  groupedItems: Partial<Record<string, T[]>>,
  callback: (item: T, groupKey: string) => R,
): R[] {
  return Object.entries(groupedItems).flatMap(([groupKey, items]) =>
    (items ?? []).map((item) => callback(item, groupKey)),
  );
}
