import {
  durationDisplay,
  secondsDisplay,
  secondsDisplayMinutesOnly,
} from "@/utils/time";

describe("secondsDisplay", () => {
  it("formats seconds only as M:SS", () => {
    expect(secondsDisplay(0)).toBe("0:00");
    expect(secondsDisplay(5)).toBe("0:05");
    expect(secondsDisplay(30)).toBe("0:30");
    expect(secondsDisplay(59)).toBe("0:59");
  });

  it("formats minutes and seconds as M:SS", () => {
    expect(secondsDisplay(60)).toBe("1:00");
    expect(secondsDisplay(90)).toBe("1:30");
    expect(secondsDisplay(125)).toBe("2:05");
    expect(secondsDisplay(599)).toBe("9:59");
    expect(secondsDisplay(3599)).toBe("59:59");
  });

  it("formats hours as H:MM:SS", () => {
    expect(secondsDisplay(3600)).toBe("1:00:00");
    expect(secondsDisplay(3661)).toBe("1:01:01");
    expect(secondsDisplay(7200)).toBe("2:00:00");
    expect(secondsDisplay(7325)).toBe("2:02:05");
    expect(secondsDisplay(36000)).toBe("10:00:00");
  });

  it("handles large values", () => {
    // 100 hours
    expect(secondsDisplay(360000)).toBe("100:00:00");
  });

  it("truncates decimals", () => {
    expect(secondsDisplay(90.7)).toBe("1:30");
    expect(secondsDisplay(3661.999)).toBe("1:01:01");
  });
});

describe("secondsDisplayMinutesOnly", () => {
  it("formats positive values as M:SS", () => {
    expect(secondsDisplayMinutesOnly(0)).toBe("0:00");
    expect(secondsDisplayMinutesOnly(30)).toBe("0:30");
    expect(secondsDisplayMinutesOnly(90)).toBe("1:30");
    expect(secondsDisplayMinutesOnly(125)).toBe("2:05");
  });

  it("formats negative values with minus sign", () => {
    expect(secondsDisplayMinutesOnly(-30)).toBe("-0:30");
    expect(secondsDisplayMinutesOnly(-90)).toBe("-1:30");
    expect(secondsDisplayMinutesOnly(-125)).toBe("-2:05");
  });

  it("shows plus sign when requested", () => {
    expect(secondsDisplayMinutesOnly(30, true)).toBe("+0:30");
    expect(secondsDisplayMinutesOnly(90, true)).toBe("+1:30");
    expect(secondsDisplayMinutesOnly(0, true)).toBe("+0:00");
  });

  it("shows minus sign regardless of showPlus", () => {
    expect(secondsDisplayMinutesOnly(-30, true)).toBe("-0:30");
    expect(secondsDisplayMinutesOnly(-30, false)).toBe("-0:30");
  });

  it("does not show plus sign by default", () => {
    expect(secondsDisplayMinutesOnly(30)).toBe("0:30");
    expect(secondsDisplayMinutesOnly(30, false)).toBe("0:30");
  });
});

describe("durationDisplay", () => {
  it("formats minutes only when less than an hour", () => {
    expect(durationDisplay("0")).toBe("0 minutes");
    expect(durationDisplay("60")).toBe("1 minutes");
    expect(durationDisplay("300")).toBe("5 minutes");
    expect(durationDisplay("3540")).toBe("59 minutes");
  });

  it("formats hours and minutes when an hour or more", () => {
    expect(durationDisplay("3600")).toBe("1 hours and 0 minutes");
    expect(durationDisplay("3660")).toBe("1 hours and 1 minutes");
    expect(durationDisplay("7200")).toBe("2 hours and 0 minutes");
    expect(durationDisplay("9000")).toBe("2 hours and 30 minutes");
  });

  it("handles large values", () => {
    // 100 hours
    expect(durationDisplay("360000")).toBe("100 hours and 0 minutes");
  });
});
