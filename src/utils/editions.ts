/**
 * Editions — the "audiobook or set" union.
 *
 * A port of the server's `Ambry.Media.Editions`, which is the authority on
 * these rules. Keep the two in step: the whole point of the edition model is
 * that a stack means the same thing on every surface, web and mobile alike.
 *
 * An edition is one recorded edition of a book: either a standalone audiobook
 * or a set (several recordings covering the book across separate releases).
 * The rules:
 *
 *   * parts order within a set: part number (nulls last), then id
 *   * a set with only one visible part presents as a single edition — a
 *     one-part "set" is noise, not a stack
 *   * representative: the first part / the audiobook itself
 *   * editions order: representative publish date, newest first (a set's date
 *     IS its first part's date), nulls last, id tiebreak
 *
 * Rendering is a recursive collapse, and the invariant is that a thing's
 * in-stack representative is the first image of its expanded rendering. So
 * index 0 of any list handed to `MultiThumbnailImage` is the cover that faces
 * front, and only the ordering differs by what is being stacked: newest
 * edition first for a book, first part first for a set.
 *
 * Filtering by status is the caller's job, done in SQL — readers never see
 * non-ready recordings, and a query that pages has to apply it before the
 * limit anyway.
 */

/** The columns an edition is computed from. */
export type EditionMedia = {
  id: string;
  recordingGroupId: string | null;
  partNumber: number | null;
  published: Date | null;
};

export type Edition<M extends EditionMedia> = {
  kind: "single" | "set";
  /** Parts in order for a set; the recording itself for a single. */
  media: M[];
  representative: M;
  /** The set this edition is, when it is one. */
  setId: string | null;
};

/**
 * Partitions a book's recordings into editions, newest first.
 *
 * A book whose recordings are all filtered out upstream yields `[]` — such a
 * book is hidden entirely rather than rendered as an empty tile.
 */
export function toEditions<M extends EditionMedia>(media: M[]): Edition<M>[] {
  const sets = new Map<string, M[]>();
  const editions: Edition<M>[] = [];

  for (const item of media) {
    if (item.recordingGroupId === null) {
      editions.push(singleEdition(item));
    } else {
      const parts = sets.get(item.recordingGroupId);
      if (parts) parts.push(item);
      else sets.set(item.recordingGroupId, [item]);
    }
  }

  for (const [setId, parts] of sets) {
    parts.sort(byPartOrder);
    // one visible part is not a set
    editions.push(
      parts.length === 1
        ? singleEdition(parts[0]!)
        : { kind: "set", media: parts, representative: parts[0]!, setId },
    );
  }

  return editions.sort(byNewestFirst);
}

/**
 * The covers a stack shows, front first, capped at three.
 *
 * Every cover comes from an edition's representative, which is what keeps a
 * collapsed stack and the tile it collapses to agreeing on their first image.
 */
export function stackedRepresentatives<M extends EditionMedia>(
  editions: Edition<M>[],
): M[] {
  return editions
    .slice(0, STACK_LIMIT)
    .map((edition) => edition.representative);
}

/** Stacks show at most three covers, everywhere. */
export const STACK_LIMIT = 3;

function singleEdition<M extends EditionMedia>(media: M): Edition<M> {
  return { kind: "single", media: [media], representative: media, setId: null };
}

/**
 * Part number ascending, nulls last, then id.
 *
 * Exported because the library listing picks its representative in SQL and
 * then sorts that set's parts here; both halves have to agree on the order or
 * the front of the stack stops being the recording the tile opens.
 */
export function byPartOrder<M extends Pick<EditionMedia, "id" | "partNumber">>(
  a: M,
  b: M,
): number {
  if (a.partNumber !== b.partNumber) {
    if (a.partNumber === null) return 1;
    if (b.partNumber === null) return -1;
    return a.partNumber - b.partNumber;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Publish date descending, nulls last, then id descending. */
function byNewestFirst<M extends EditionMedia>(
  a: Edition<M>,
  b: Edition<M>,
): number {
  const aPublished = a.representative.published;
  const bPublished = b.representative.published;

  if (aPublished?.getTime() !== bPublished?.getTime()) {
    if (aPublished === null) return 1;
    if (bPublished === null) return -1;
    return bPublished.getTime() - aPublished.getTime();
  }

  const aId = a.representative.id;
  const bId = b.representative.id;
  return aId < bId ? 1 : aId > bId ? -1 : 0;
}
