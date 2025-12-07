import { groupMapBy } from "../group-map-by";

describe("groupMapBy", () => {
  it("groups items by key", () => {
    const items = [
      { name: "Alice", department: "Engineering" },
      { name: "Bob", department: "Sales" },
      { name: "Carol", department: "Engineering" },
    ];

    const result = groupMapBy(items, (item) => item.department);

    expect(result).toEqual({
      Engineering: [
        { name: "Alice", department: "Engineering" },
        { name: "Carol", department: "Engineering" },
      ],
      Sales: [{ name: "Bob", department: "Sales" }],
    });
  });

  it("applies map function when provided", () => {
    const items = [
      { name: "Alice", department: "Engineering" },
      { name: "Bob", department: "Sales" },
      { name: "Carol", department: "Engineering" },
    ];

    const result = groupMapBy(
      items,
      (item) => item.department,
      (item) => item.name,
    );

    expect(result).toEqual({
      Engineering: ["Alice", "Carol"],
      Sales: ["Bob"],
    });
  });

  it("handles empty array", () => {
    const result = groupMapBy([], (item: { key: string }) => item.key);
    expect(result).toEqual({});
  });

  it("handles single item", () => {
    const items = [{ id: 1, category: "A" }];
    const result = groupMapBy(items, (item) => item.category);

    expect(result).toEqual({
      A: [{ id: 1, category: "A" }],
    });
  });

  it("works with numeric keys", () => {
    const items = [
      { value: "a", group: 1 },
      { value: "b", group: 2 },
      { value: "c", group: 1 },
    ];

    const result = groupMapBy(items, (item) => item.group);

    expect(result).toEqual({
      1: [
        { value: "a", group: 1 },
        { value: "c", group: 1 },
      ],
      2: [{ value: "b", group: 2 }],
    });
  });

  it("preserves order within groups", () => {
    const items = [
      { id: 1, group: "A" },
      { id: 2, group: "A" },
      { id: 3, group: "A" },
    ];

    const result = groupMapBy(
      items,
      (item) => item.group,
      (item) => item.id,
    );

    expect(result).toEqual({ A: [1, 2, 3] });
  });
});
