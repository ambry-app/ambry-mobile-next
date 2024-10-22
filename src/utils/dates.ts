export function formatPublished(
  published: Date,
  publishedFormat: string,
  month: "short" | "long" = "long",
) {
  const options: Intl.DateTimeFormatOptions =
    publishedFormat === "full"
      ? { year: "numeric", month, day: "numeric" }
      : publishedFormat === "year_month"
        ? { year: "numeric", month }
        : { year: "numeric" };
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(published);
}
