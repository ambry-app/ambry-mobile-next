import {
  partLabel,
  partsLabel,
  recordingTitle,
  setLabel,
  setSubtitle,
} from "@/utils/titles";

describe("recordingTitle", () => {
  it("uses the book's title when the recording has no override", () => {
    expect(recordingTitle(null, "Leviathan Wakes")).toBe("Leviathan Wakes");
  });

  it("prefers the recording's own title when it has one", () => {
    expect(recordingTitle("Der Kalte Krieg", "Leviathan Wakes")).toBe(
      "Der Kalte Krieg",
    );
  });

  it("treats a missing override the same as an absent one", () => {
    expect(recordingTitle(undefined, "Leviathan Wakes")).toBe(
      "Leviathan Wakes",
    );
  });
});

describe("partLabel", () => {
  const set = { partsTotal: 3, partWord: null };

  it("has no label for a recording that is not part of a set", () => {
    expect(partLabel(null, set)).toBeNull();
    expect(partLabel(undefined, null)).toBeNull();
  });

  it("names the part and the total", () => {
    expect(partLabel(2, set)).toBe("Part 2 of 3");
  });

  it("stops after the number when the total is unknown", () => {
    expect(partLabel(2, { partsTotal: null, partWord: null })).toBe("Part 2");
  });

  it("stops after the number when the total is already on screen", () => {
    expect(partLabel(2, set, { includeTotal: false })).toBe("Part 2");
  });

  it("uses the set's own wording, capitalised", () => {
    expect(partLabel(2, { partsTotal: 4, partWord: "volume" })).toBe(
      "Volume 2 of 4",
    );
  });

  it('falls back to "part" when the set names no wording', () => {
    expect(partLabel(1, null)).toBe("Part 1");
  });
});

describe("partsLabel", () => {
  it("describes the set by its stated total", () => {
    expect(
      partsLabel({ partsTotal: 3, partWord: null, partWordPlural: null }, 2),
    ).toBe("3 parts");
  });

  it("falls back to what is actually on the device", () => {
    expect(
      partsLabel({ partsTotal: null, partWord: null, partWordPlural: null }, 2),
    ).toBe("2 parts");
  });

  it("uses the singular wording for a set of one", () => {
    expect(
      partsLabel({ partsTotal: 1, partWord: null, partWordPlural: null }, 1),
    ).toBe("1 part");
  });

  it("uses the set's own plural wording", () => {
    expect(
      partsLabel(
        { partsTotal: 5, partWord: "volume", partWordPlural: "volumes" },
        5,
      ),
    ).toBe("5 volumes");
  });
});

describe("setLabel", () => {
  it("gives the name when the operator opted in", () => {
    expect(setLabel({ name: "GraphicAudio", showLabel: true })).toBe(
      "GraphicAudio",
    );
  });

  it("withholds the name when they did not", () => {
    // most set names are filing labels -- "batch 2", "from mam" -- so the
    // flag is the only thing that may decide this, never the name itself
    expect(setLabel({ name: "GraphicAudio", showLabel: false })).toBeNull();
  });

  it("has nothing to show for a set with no name", () => {
    expect(setLabel({ name: null, showLabel: true })).toBeNull();
  });

  it("has nothing to show when there is no set", () => {
    expect(setLabel(null)).toBeNull();
    expect(setLabel(undefined)).toBeNull();
  });
});

describe("setSubtitle", () => {
  const threeParts = {
    partsTotal: 3,
    partWord: null,
    partWordPlural: null,
  };

  it("joins the name and the size on one line", () => {
    expect(
      setSubtitle({ ...threeParts, name: "GraphicAudio", showLabel: true }, 3),
    ).toBe("GraphicAudio · 3 parts");
  });

  it("leaves the size alone when the name is withheld", () => {
    expect(
      setSubtitle({ ...threeParts, name: "GraphicAudio", showLabel: false }, 3),
    ).toBe("3 parts");
  });

  it("leaves the size alone when there is no name", () => {
    expect(setSubtitle({ ...threeParts, name: null, showLabel: true }, 3)).toBe(
      "3 parts",
    );
  });

  it("keeps the set's own wording", () => {
    expect(
      setSubtitle(
        {
          name: "Dramatized",
          showLabel: true,
          partsTotal: 6,
          partWord: "episode",
          partWordPlural: "episodes",
        },
        6,
      ),
    ).toBe("Dramatized · 6 episodes");
  });
});
