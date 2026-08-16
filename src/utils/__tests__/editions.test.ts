import {
  Edition,
  EditionMedia,
  stackedRepresentatives,
  toEditions,
} from "@/utils/editions";

function media(
  id: string,
  attrs: Partial<Omit<EditionMedia, "id">> = {},
): EditionMedia {
  return {
    id,
    recordingGroupId: attrs.recordingGroupId ?? null,
    partNumber: attrs.partNumber ?? null,
    published: attrs.published ?? null,
  };
}

function ids(editions: Edition<EditionMedia>[]) {
  return editions.map((edition) => edition.media.map((m) => m.id));
}

describe("toEditions", () => {
  it("returns no editions for a book with nothing visible", () => {
    expect(toEditions([])).toEqual([]);
  });

  it("makes one edition per standalone recording", () => {
    const editions = toEditions([
      media("a", { published: new Date("2020-01-01") }),
      media("b", { published: new Date("2024-01-01") }),
    ]);

    expect(ids(editions)).toEqual([["b"], ["a"]]);
    expect(editions.every((edition) => edition.kind === "single")).toBe(true);
  });

  it("gathers a set's parts into one edition, in part order", () => {
    const editions = toEditions([
      media("c", { recordingGroupId: "set", partNumber: 3 }),
      media("a", { recordingGroupId: "set", partNumber: 1 }),
      media("b", { recordingGroupId: "set", partNumber: 2 }),
    ]);

    expect(ids(editions)).toEqual([["a", "b", "c"]]);
    expect(editions[0]!.kind).toBe("set");
    expect(editions[0]!.representative.id).toBe("a");
    expect(editions[0]!.setId).toBe("set");
  });

  it("orders parts with no number last, then by id", () => {
    const editions = toEditions([
      media("z", { recordingGroupId: "set" }),
      media("b", { recordingGroupId: "set", partNumber: 2 }),
      media("m", { recordingGroupId: "set" }),
      media("a", { recordingGroupId: "set", partNumber: 1 }),
    ]);

    expect(ids(editions)).toEqual([["a", "b", "m", "z"]]);
  });

  it("presents a set with one visible part as a single edition", () => {
    // the rest of the set is still processing, so only part 1 is visible; a
    // one-part stack is noise, not a set
    const editions = toEditions([
      media("a", { recordingGroupId: "set", partNumber: 1 }),
    ]);

    expect(editions).toHaveLength(1);
    expect(editions[0]!.kind).toBe("single");
    expect(editions[0]!.setId).toBeNull();
  });

  it("keeps two sets of the same book apart", () => {
    const editions = toEditions([
      media("a1", {
        recordingGroupId: "one",
        partNumber: 1,
        published: new Date("2019-01-01"),
      }),
      media("b1", {
        recordingGroupId: "two",
        partNumber: 1,
        published: new Date("2023-01-01"),
      }),
      media("a2", { recordingGroupId: "one", partNumber: 2 }),
      media("b2", { recordingGroupId: "two", partNumber: 2 }),
    ]);

    expect(ids(editions)).toEqual([
      ["b1", "b2"],
      ["a1", "a2"],
    ]);
  });

  it("dates a set by its first part, not its newest", () => {
    // part 3 is the most recent release, but the set is as old as it started
    const editions = toEditions([
      media("solo", { published: new Date("2021-01-01") }),
      media("p1", {
        recordingGroupId: "set",
        partNumber: 1,
        published: new Date("2020-01-01"),
      }),
      media("p3", {
        recordingGroupId: "set",
        partNumber: 3,
        published: new Date("2022-01-01"),
      }),
    ]);

    expect(ids(editions)).toEqual([["solo"], ["p1", "p3"]]);
  });

  it("orders editions with no publish date last", () => {
    const editions = toEditions([
      media("undated"),
      media("old", { published: new Date("1999-01-01") }),
    ]);

    expect(ids(editions)).toEqual([["old"], ["undated"]]);
  });

  it("breaks a publish-date tie by id, descending", () => {
    const sameDay = new Date("2024-06-01");
    const editions = toEditions([
      media("a", { published: sameDay }),
      media("c", { published: sameDay }),
      media("b", { published: sameDay }),
    ]);

    expect(ids(editions)).toEqual([["c"], ["b"], ["a"]]);
  });
});

describe("stackedRepresentatives", () => {
  it("takes one cover per edition, newest first", () => {
    const editions = toEditions([
      media("new", { published: new Date("2024-01-01") }),
      media("old", { published: new Date("2004-01-01") }),
    ]);

    expect(stackedRepresentatives(editions).map((m) => m.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("collapses a set to its first part", () => {
    // the sole-edition exception is dead: a book whose only edition is a
    // three-part set shows one cover, not three
    const editions = toEditions([
      media("p1", { recordingGroupId: "set", partNumber: 1 }),
      media("p2", { recordingGroupId: "set", partNumber: 2 }),
      media("p3", { recordingGroupId: "set", partNumber: 3 }),
    ]);

    expect(stackedRepresentatives(editions).map((m) => m.id)).toEqual(["p1"]);
  });

  it("caps at three covers", () => {
    const editions = toEditions([
      media("a", { published: new Date("2024-01-01") }),
      media("b", { published: new Date("2023-01-01") }),
      media("c", { published: new Date("2022-01-01") }),
      media("d", { published: new Date("2021-01-01") }),
    ]);

    expect(stackedRepresentatives(editions).map((m) => m.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
