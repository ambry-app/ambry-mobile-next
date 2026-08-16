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

/**
 * The line under a set's title, e.g. "GraphicAudio · 3 parts" or "3 parts".
 *
 * A tile has room for lines, not for paragraphs, so the set's name and its
 * size share one. The name drops out when the operator has not asked for it,
 * leaving the size on its own.
 */
export function setSubtitle(
  set: {
    name: string | null;
    showLabel: boolean;
    partsTotal: number | null;
    partWord: string | null;
    partWordPlural: string | null;
  },
  count: number,
): string {
  return withSetName(set, partsLabel(set, count));
}

/**
 * The same line for one part of a set, e.g. "GraphicAudio · Part 1 of 2".
 *
 * Which part you are looking at and which set it came from are the two things
 * that tell one recording of a book from another, so they travel together.
 * Returns null for a recording that is not part of a set — there is nothing to
 * say about it.
 */
export function partSubtitle(
  partNumber: number | null | undefined,
  set:
    | {
        name: string | null;
        showLabel: boolean;
        partsTotal: number | null;
        partWord: string | null;
      }
    | null
    | undefined,
  options: { includeTotal?: boolean } = {},
): string | null {
  const part = partLabel(partNumber, set ?? null, options);

  return part && withSetName(set, part);
}

/**
 * Puts the set's name in front of a label, when readers are meant to see it.
 *
 * The separator is a middle dot rather than a dash: the app has no dashes in
 * rendered text.
 */
function withSetName(
  set: { name: string | null; showLabel: boolean } | null | undefined,
  label: string,
): string {
  const name = setLabel(set);

  return name ? `${name} · ${label}` : label;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
