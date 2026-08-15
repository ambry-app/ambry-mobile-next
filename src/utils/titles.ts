/**
 * How a recording is titled.
 *
 * A recording usually goes by its book's title, but it may carry its own:
 * a translated, regional or retail title that differs from the work's. The
 * server stores that as an override which is null whenever the book's title
 * applies, so every surface that names a recording resolves it the same way.
 */
export function recordingTitle(
  overrideTitle: string | null | undefined,
  bookTitle: string,
): string {
  return overrideTitle ?? bookTitle;
}

/**
 * How one part of a multi-part set is labelled, e.g. "Part 2 of 3".
 *
 * A set carries its own wording because not every set is made of "parts":
 * some are volumes, books or episodes. When the total is unknown the label
 * stops after the number rather than inventing one. Pass `includeTotal: false`
 * where the total is already on screen, so a tile reads "Part 2".
 */
export function partLabel(
  partNumber: number | null | undefined,
  set: { partsTotal: number | null; partWord: string | null } | null,
  { includeTotal = true }: { includeTotal?: boolean } = {},
): string | null {
  if (partNumber === null || partNumber === undefined) return null;

  const word = capitalize(set?.partWord ?? "part");

  if (!includeTotal || !set?.partsTotal) return `${word} ${partNumber}`;

  return `${word} ${partNumber} of ${set.partsTotal}`;
}

/**
 * A set's name, when readers are meant to see it.
 *
 * Every set has a name, but most of them are filing labels that mean something
 * to the operator and nothing to a reader ("batch 2", "from mam"). The server
 * carries an explicit per-set choice, and this is the only thing that should
 * decide whether the name reaches a screen — never the name itself.
 */
export function setLabel(
  set: { name: string | null; showLabel: boolean } | null | undefined,
): string | null {
  if (!set?.showLabel) return null;

  return set.name;
}

/**
 * How a whole set is described, e.g. "3 parts".
 */
export function partsLabel(
  set: {
    partsTotal: number | null;
    partWord: string | null;
    partWordPlural: string | null;
  },
  count: number,
): string {
  const total = set.partsTotal ?? count;
  const word =
    total === 1 ? (set.partWord ?? "part") : (set.partWordPlural ?? "parts");

  return `${total} ${word}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
