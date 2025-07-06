export function flatMapGroups<T, R>(
  groupedItems: Partial<Record<string, T[]>>,
  callback: (item: T, groupKey: string) => R,
): R[] {
  return Object.entries(groupedItems).flatMap(([groupKey, items]) =>
    (items ?? []).map((item) => callback(item, groupKey)),
  );
}
