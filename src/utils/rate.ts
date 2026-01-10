/**
 * Format a playback rate as a string with exactly two decimal places.
 *
 * @example
 * formatPlaybackRate(1)    // "1.00"
 * formatPlaybackRate(1.5)  // "1.50"
 * formatPlaybackRate(1.25) // "1.25"
 */
export function formatPlaybackRate(rate: number) {
  return rate.toFixed(2);
}
