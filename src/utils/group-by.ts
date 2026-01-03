export const groupBy = <T, K extends keyof any, V>(
  list: T[],
  getKey: (item: T) => K,
  getValue: (item: T) => V,
) => {
  return list.reduce(
    (previous, currentItem) => {
      const group = getKey(currentItem);
      if (!previous[group]) previous[group] = [];
      previous[group].push(getValue(currentItem));
      return previous;
    },
    {} as Record<K, V[]>,
  );
};
