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

/**
 * Format a date as a human-friendly relative time string.
 * e.g., "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", "2 weeks ago", "last month", "3 months ago"
 */
export function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks === 1) {
    return "last week";
  }
  if (weeks < 4) {
    return `${weeks} weeks ago`;
  }

  const months = Math.floor(days / 30);
  if (months === 1) {
    return "last month";
  }
  if (months < 12) {
    return `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? "last year" : `${years} years ago`;
}
