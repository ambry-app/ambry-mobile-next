import { formatPlaybackRate } from "@/utils/rate";

describe("formatPlaybackRate", () => {
  it("formats whole numbers with two decimal places", () => {
    expect(formatPlaybackRate(1)).toBe("1.00");
    expect(formatPlaybackRate(2)).toBe("2.00");
  });

  it("formats one decimal place with trailing zero", () => {
    expect(formatPlaybackRate(1.5)).toBe("1.50");
    expect(formatPlaybackRate(0.5)).toBe("0.50");
  });

  it("formats two decimal places as-is", () => {
    expect(formatPlaybackRate(1.25)).toBe("1.25");
    expect(formatPlaybackRate(1.75)).toBe("1.75");
  });

  it("rounds to two decimal places", () => {
    expect(formatPlaybackRate(1.256)).toBe("1.26");
    expect(formatPlaybackRate(1.254)).toBe("1.25");
    expect(formatPlaybackRate(1.999)).toBe("2.00");
  });

  it("handles common playback rates", () => {
    expect(formatPlaybackRate(0.75)).toBe("0.75");
    expect(formatPlaybackRate(1.0)).toBe("1.00");
    expect(formatPlaybackRate(1.25)).toBe("1.25");
    expect(formatPlaybackRate(1.5)).toBe("1.50");
    expect(formatPlaybackRate(2.0)).toBe("2.00");
  });
});
