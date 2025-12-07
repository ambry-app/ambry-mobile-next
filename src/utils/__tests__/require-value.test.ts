import { requireValue } from "../require-value";

describe("requireValue", () => {
  it("returns the value when defined", () => {
    expect(requireValue("hello", "error")).toBe("hello");
    expect(requireValue(42, "error")).toBe(42);
    expect(requireValue(0, "error")).toBe(0);
    expect(requireValue("", "error")).toBe("");
    expect(requireValue(false, "error")).toBe(false);
  });

  it("returns null when value is null (null is not undefined)", () => {
    expect(requireValue(null, "error")).toBe(null);
  });

  it("throws when value is undefined", () => {
    expect(() => requireValue(undefined, "Value is required")).toThrow(
      "Value is required",
    );
  });

  it("throws with custom message", () => {
    expect(() => requireValue(undefined, "Missing user ID")).toThrow(
      "Missing user ID",
    );
  });

  it("preserves type in return value", () => {
    const obj = { id: 1, name: "test" };
    const result = requireValue(obj, "error");
    expect(result).toBe(obj);
    expect(result.id).toBe(1);
    expect(result.name).toBe("test");
  });

  it("works with arrays", () => {
    const arr = [1, 2, 3];
    expect(requireValue(arr, "error")).toBe(arr);
    expect(requireValue([], "error")).toEqual([]);
  });
});
