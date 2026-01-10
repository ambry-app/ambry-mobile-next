/**
 * Format seconds as a human-readable duration string.
 * Uses H:MM:SS format for times >= 1 hour, M:SS for shorter times.
 *
 * @example
 * secondsDisplay(90)    // "1:30"
 * secondsDisplay(3661)  // "1:01:01"
 */
export function secondsDisplay(total: number): string {
  const hours = String(Math.floor(total / 3600));
  const minutes = String(Math.floor((total % 3600) / 60));
  const seconds = String(Math.floor((total % 3600) % 60));

  if (hours === "0") {
    return `${minutes}:${seconds.padStart(2, "0")}`;
  } else {
    return `${hours}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
  }
}

/**
 * Format seconds as M:SS, always showing minutes (no hours).
 * Supports negative values and optional plus sign for positive values.
 *
 * @example
 * secondsDisplayMinutesOnly(90)        // "1:30"
 * secondsDisplayMinutesOnly(-90)       // "-1:30"
 * secondsDisplayMinutesOnly(90, true)  // "+1:30"
 */
export function secondsDisplayMinutesOnly(
  total: number,
  showPlus: boolean = false,
): string {
  const totalInSeconds = Math.abs(total);
  const minutes = String(Math.floor(totalInSeconds / 60));
  const seconds = String(Math.floor(totalInSeconds % 60));

  return `${total < 0 ? "-" : showPlus ? "+" : ""}${minutes}:${seconds.padStart(2, "0")}`;
}

/**
 * Format a duration string (in seconds) as a human-readable phrase.
 * Uses "X minutes" for < 1 hour, "X hours and Y minutes" for longer.
 *
 * @example
 * durationDisplay("300")   // "5 minutes"
 * durationDisplay("3660")  // "1 hours and 1 minutes"
 */
export function durationDisplay(input: string): string {
  const total = Number(input);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) {
    return `${minutes} minutes`;
  } else {
    return `${hours} hours and ${minutes} minutes`;
  }
}
