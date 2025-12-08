import { flatMapGroups } from "@/utils/flat-map-groups";

describe("flatMapGroups", () => {
  it("flattens grouped items with callback", () => {
    const grouped = {
      fruits: ["apple", "banana"],
      vegetables: ["carrot"],
    };

    const result = flatMapGroups(grouped, (item, groupKey) => ({
      item,
      category: groupKey,
    }));

    expect(result).toEqual([
      { item: "apple", category: "fruits" },
      { item: "banana", category: "fruits" },
      { item: "carrot", category: "vegetables" },
    ]);
  });

  it("handles empty groups", () => {
    const grouped = {
      a: ["item1"],
      b: [] as string[],
      c: ["item2"],
    };

    const result = flatMapGroups(grouped, (item) => item);

    expect(result).toEqual(["item1", "item2"]);
  });

  it("handles undefined groups", () => {
    const grouped = {
      a: ["item1"],
      b: undefined,
    };

    const result = flatMapGroups(grouped, (item) => item);

    expect(result).toEqual(["item1"]);
  });

  it("handles empty object", () => {
    const result = flatMapGroups({}, (item: string) => item);
    expect(result).toEqual([]);
  });

  it("transforms items using callback", () => {
    const grouped = {
      numbers: [1, 2, 3],
    };

    const result = flatMapGroups(grouped, (num) => num * 2);

    expect(result).toEqual([2, 4, 6]);
  });

  it("provides group key to callback", () => {
    const grouped = {
      A: [1],
      B: [2],
    };

    const keys: string[] = [];
    flatMapGroups(grouped, (_, groupKey) => {
      keys.push(groupKey);
      return groupKey;
    });

    expect(keys.sort()).toEqual(["A", "B"]);
  });
});
