import {
  bookDuration,
  bookPositionOf,
  type TimelineTrack,
  trackAt,
} from "@/utils/playback-timeline";

// three files, an hour each
const threeParts: TimelineTrack[] = [
  { startOffset: 0, duration: 3600 },
  { startOffset: 3600, duration: 3600 },
  { startOffset: 7200, duration: 1800 },
];

const singleFile: TimelineTrack[] = [{ startOffset: 0, duration: 5400 }];

describe("bookDuration", () => {
  it("runs to the end of the last file", () => {
    expect(bookDuration(threeParts)).toBe(9000);
  });

  it("is the file's own duration when there is only one", () => {
    expect(bookDuration(singleFile)).toBe(5400);
  });

  it("is zero when there are no files", () => {
    expect(bookDuration([])).toBe(0);
  });

  it("trusts the last file's offset rather than summing durations", () => {
    // a gap between files must not shorten the book
    const withGap: TimelineTrack[] = [
      { startOffset: 0, duration: 100 },
      { startOffset: 500, duration: 100 },
    ];

    expect(bookDuration(withGap)).toBe(600);
  });
});

describe("trackAt", () => {
  it("finds a position inside the first file", () => {
    expect(trackAt(threeParts, 100)).toEqual({ index: 0, position: 100 });
  });

  it("finds a position inside a later file", () => {
    expect(trackAt(threeParts, 5000)).toEqual({ index: 1, position: 1400 });
  });

  it("gives a boundary to the file that starts there", () => {
    expect(trackAt(threeParts, 3600)).toEqual({ index: 1, position: 0 });
    expect(trackAt(threeParts, 7200)).toEqual({ index: 2, position: 0 });
  });

  it("clamps a position before the start of the book", () => {
    expect(trackAt(threeParts, -30)).toEqual({ index: 0, position: 0 });
  });

  it("clamps a position past the end of the book", () => {
    expect(trackAt(threeParts, 99999)).toEqual({ index: 2, position: 1800 });
  });

  it("handles the single-file case as a straight pass-through", () => {
    expect(trackAt(singleFile, 1234)).toEqual({ index: 0, position: 1234 });
  });

  it("has somewhere to point when there are no files", () => {
    expect(trackAt([], 100)).toEqual({ index: 0, position: 0 });
  });

  it("keeps fractional offsets intact", () => {
    const fractional: TimelineTrack[] = [
      { startOffset: 0, duration: 1800.5 },
      { startOffset: 1800.5, duration: 1800.25 },
    ];

    expect(trackAt(fractional, 1800.75)).toEqual({
      index: 1,
      position: 0.25,
    });
  });

  it("does not spill into the gap between files", () => {
    const withGap: TimelineTrack[] = [
      { startOffset: 0, duration: 100 },
      { startOffset: 500, duration: 100 },
    ];

    // 200 is past the end of file 1 but before file 2 begins; the best answer
    // is the end of file 1 rather than a position file 1 does not contain
    expect(trackAt(withGap, 200)).toEqual({ index: 0, position: 100 });
  });
});

describe("bookPositionOf", () => {
  it("offsets a position in the first file by nothing", () => {
    expect(bookPositionOf(threeParts, 0, 100)).toBe(100);
  });

  it("offsets a position in a later file by where that file starts", () => {
    expect(bookPositionOf(threeParts, 1, 1400)).toBe(5000);
    expect(bookPositionOf(threeParts, 2, 900)).toBe(8100);
  });

  it("round-trips with trackAt", () => {
    for (const position of [0, 1, 3599.9, 3600, 5000, 8999, 9000]) {
      const { index, position: local } = trackAt(threeParts, position);
      expect(bookPositionOf(threeParts, index, local)).toBeCloseTo(position, 6);
    }
  });

  it("passes the position through when the file is unknown", () => {
    expect(bookPositionOf(threeParts, 99, 42)).toBe(42);
  });
});
