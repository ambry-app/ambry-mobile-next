import { formatPublished, timeAgo } from "@/utils/date";

describe("timeAgo", () => {
  // Helper to create a date relative to "now"
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);
  const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  describe("seconds", () => {
    it("returns 'just now' for times less than a minute ago", () => {
      expect(timeAgo(new Date())).toBe("just now");
      expect(timeAgo(new Date(Date.now() - 30 * 1000))).toBe("just now");
      expect(timeAgo(new Date(Date.now() - 59 * 1000))).toBe("just now");
    });
  });

  describe("minutes", () => {
    it("returns '1 minute ago' for exactly 1 minute", () => {
      expect(timeAgo(minutesAgo(1))).toBe("1 minute ago");
    });

    it("returns 'X minutes ago' for 2-59 minutes", () => {
      expect(timeAgo(minutesAgo(2))).toBe("2 minutes ago");
      expect(timeAgo(minutesAgo(30))).toBe("30 minutes ago");
      expect(timeAgo(minutesAgo(59))).toBe("59 minutes ago");
    });
  });

  describe("hours", () => {
    it("returns '1 hour ago' for exactly 1 hour", () => {
      expect(timeAgo(hoursAgo(1))).toBe("1 hour ago");
    });

    it("returns 'X hours ago' for 2-23 hours", () => {
      expect(timeAgo(hoursAgo(2))).toBe("2 hours ago");
      expect(timeAgo(hoursAgo(12))).toBe("12 hours ago");
      expect(timeAgo(hoursAgo(23))).toBe("23 hours ago");
    });
  });

  describe("days", () => {
    it("returns 'yesterday' for exactly 1 day", () => {
      expect(timeAgo(daysAgo(1))).toBe("yesterday");
    });

    it("returns 'X days ago' for 2-6 days", () => {
      expect(timeAgo(daysAgo(2))).toBe("2 days ago");
      expect(timeAgo(daysAgo(6))).toBe("6 days ago");
    });
  });

  describe("weeks", () => {
    it("returns 'last week' for 7 days", () => {
      expect(timeAgo(daysAgo(7))).toBe("last week");
    });

    it("returns 'X weeks ago' for 2-4 weeks", () => {
      expect(timeAgo(daysAgo(14))).toBe("2 weeks ago");
      expect(timeAgo(daysAgo(21))).toBe("3 weeks ago");
      expect(timeAgo(daysAgo(28))).toBe("4 weeks ago");
      expect(timeAgo(daysAgo(29))).toBe("4 weeks ago");
    });
  });

  describe("months", () => {
    it("returns 'last month' for ~30 days", () => {
      expect(timeAgo(daysAgo(30))).toBe("last month");
    });

    it("returns 'X months ago' for 2-11 months", () => {
      expect(timeAgo(daysAgo(60))).toBe("2 months ago");
      expect(timeAgo(daysAgo(180))).toBe("6 months ago");
      expect(timeAgo(daysAgo(330))).toBe("11 months ago");
    });
  });

  describe("years", () => {
    it("returns 'last year' for ~365 days", () => {
      expect(timeAgo(daysAgo(365))).toBe("last year");
    });

    it("returns 'X years ago' for 2+ years", () => {
      expect(timeAgo(daysAgo(730))).toBe("2 years ago");
      expect(timeAgo(daysAgo(1825))).toBe("5 years ago");
    });
  });
});

describe("formatPublished", () => {
  // Use a fixed date to avoid timezone issues
  const date = new Date("2023-06-15T00:00:00Z");

  it("formats full date", () => {
    expect(formatPublished(date, "full")).toBe("June 15, 2023");
  });

  it("formats year and month", () => {
    expect(formatPublished(date, "year_month")).toBe("June 2023");
  });

  it("formats year only", () => {
    expect(formatPublished(date, "year")).toBe("2023");
  });

  it("supports short month format", () => {
    expect(formatPublished(date, "full", "short")).toBe("Jun 15, 2023");
    expect(formatPublished(date, "year_month", "short")).toBe("Jun 2023");
  });
});
