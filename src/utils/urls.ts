/**
 * Build a URL for something the server holds.
 *
 * Library paths are real filenames, so they routinely contain spaces,
 * brackets, ampersands and apostrophes: `/files/track/x9/This Is How You Lose
 * the Time War - 001.mp3`. Those have to be percent-encoded. A streaming
 * player will often accept the raw string anyway, which is how this stayed
 * hidden, but a stricter URL parser rejects it outright — Android's
 * `java.net.URI` throws on the first space, and so does curl.
 *
 * Each path segment is encoded on its own so the separators survive. Paths
 * made only of safe characters, which is every legacy `/uploads/...` path,
 * come back byte-for-byte identical.
 */
export function serverUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
    .replace(/^\/+/, "");

  return `${base}/${encoded}`;
}
