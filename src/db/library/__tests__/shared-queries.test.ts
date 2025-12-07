import { combineAuthorsAndNarrators } from "../shared-queries";

// Helper to create test authors
function makeAuthor(
  id: string,
  name: string,
  personId: string,
  personName: string = personId,
) {
  return {
    type: "author" as const,
    id,
    name,
    person: { id: personId, name: personName, thumbnails: null },
  };
}

// Helper to create test narrators
function makeNarrator(
  id: string,
  name: string,
  personId: string,
  personName: string = personId,
) {
  return {
    type: "narrator" as const,
    id,
    name,
    person: { id: personId, name: personName, thumbnails: null },
  };
}

describe("combineAuthorsAndNarrators", () => {
  it("returns empty array for empty inputs", () => {
    expect(combineAuthorsAndNarrators([], [])).toEqual([]);
  });

  it("returns authors only when no narrators", () => {
    const authors = [makeAuthor("a1", "Stephen King", "p1", "Stephen King")];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toEqual([
      {
        id: "p1",
        type: "author",
        names: ["Stephen King"],
        realName: "Stephen King",
        thumbnails: null,
      },
    ]);
  });

  it("returns narrators only when no authors", () => {
    const narrators = [makeNarrator("n1", "James Earl Jones", "p2")];

    const result = combineAuthorsAndNarrators([], narrators);

    expect(result).toEqual([
      {
        id: "p2",
        type: "narrator",
        names: ["James Earl Jones"],
        realName: "p2",
        thumbnails: null,
      },
    ]);
  });

  it("combines separate authors and narrators", () => {
    const authors = [makeAuthor("a1", "Author One", "p1")];
    const narrators = [makeNarrator("n1", "Narrator One", "p2")];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      id: "p1",
      type: "author",
      names: ["Author One"],
      realName: "p1",
      thumbnails: null,
    });
    expect(result).toContainEqual({
      id: "p2",
      type: "narrator",
      names: ["Narrator One"],
      realName: "p2",
      thumbnails: null,
    });
  });

  it("marks person as authorAndNarrator when they have both roles", () => {
    const authors = [makeAuthor("a1", "Neil Gaiman", "p1", "Neil Gaiman")];
    const narrators = [makeNarrator("n1", "Neil Gaiman", "p1", "Neil Gaiman")];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "p1",
      type: "authorAndNarrator",
      names: ["Neil Gaiman"],
      realName: "Neil Gaiman",
      thumbnails: null,
    });
  });

  it("collects multiple pen names for the same person", () => {
    const authors = [
      makeAuthor("a1", "Richard Bachman", "p1", "Stephen King"),
      makeAuthor("a2", "Stephen King", "p1", "Stephen King"),
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "p1",
      type: "author",
      names: ["Richard Bachman", "Stephen King"],
      realName: "Stephen King",
      thumbnails: null,
    });
  });

  it("does not duplicate identical names", () => {
    const authors = [
      makeAuthor("a1", "Stephen King", "p1", "Stephen King"),
      makeAuthor("a2", "Stephen King", "p1", "Stephen King"),
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result).toHaveLength(1);
    expect(result[0]?.names).toEqual(["Stephen King"]);
  });

  it("handles complex scenario with multiple people and roles", () => {
    const authors = [
      makeAuthor("a1", "Author A", "p1"),
      makeAuthor("a2", "Pen Name A", "p1"),
      makeAuthor("a3", "Author B", "p2"),
    ];
    const narrators = [
      makeNarrator("n1", "Author A", "p1"), // Same person, also narrates
      makeNarrator("n2", "Narrator C", "p3"),
    ];

    const result = combineAuthorsAndNarrators(authors, narrators);

    expect(result).toHaveLength(3);

    const p1 = result.find((r) => r.id === "p1");
    expect(p1).toEqual({
      id: "p1",
      type: "authorAndNarrator",
      names: ["Author A", "Pen Name A"],
      realName: "p1",
      thumbnails: null,
    });

    const p2 = result.find((r) => r.id === "p2");
    expect(p2?.type).toBe("author");

    const p3 = result.find((r) => r.id === "p3");
    expect(p3?.type).toBe("narrator");
  });

  it("preserves thumbnails from the first entry", () => {
    // Use a mock thumbnails object - we just care that it's passed through
    const thumbnails = { mock: "thumbnails" } as unknown as Parameters<
      typeof combineAuthorsAndNarrators
    >[0][0]["person"]["thumbnails"];
    const authors = [
      {
        type: "author" as const,
        id: "a1",
        name: "Author",
        person: { id: "p1", name: "Real Name", thumbnails },
      },
    ];

    const result = combineAuthorsAndNarrators(authors, []);

    expect(result[0]?.thumbnails).toBe(thumbnails);
  });

  it("maintains insertion order from authors then narrators", () => {
    const authors = [
      makeAuthor("a1", "First Author", "p1"),
      makeAuthor("a2", "Second Author", "p2"),
    ];
    const narrators = [
      makeNarrator("n1", "Third Person", "p3"),
      makeNarrator("n2", "Fourth Person", "p4"),
    ];

    const result = combineAuthorsAndNarrators(authors, narrators);
    const ids = result.map((r) => r.id);

    expect(ids).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
