import { and, desc, eq, inArray, isNull, like, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { DownloadedThumbnails, Thumbnails } from "@/db/schema";
import { Session } from "@/types/session";
import { byPartOrder } from "@/utils/editions";

import {
  getAuthorsForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
} from "./shared-queries";

export type MediaPage = Awaited<ReturnType<typeof getMediaPage>>;

export type MediaSearchResult = Awaited<ReturnType<typeof getSearchedMedia>>;

export async function getMediaPage(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  const media = await recentMedia(session, limit, insertedBefore);

  return withEditionDetails(session, media);
}

/**
 * Turns representative rows into editions ready to render.
 *
 * The rows arriving here are already collapsed — one per edition — so this
 * fills in what a tile needs around them: the book's authors, the
 * representative's own details, and, for a row standing in for a set, the rest
 * of that set's parts so the tile can stack them.
 */
async function withEditionDetails<T extends RepresentativeRow>(
  session: Session,
  media: T[],
) {
  const bookIds = media.map((m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const setIds = media
    .map((m) => m.recordingGroupId)
    .filter((id): id is string => id !== null);
  const partsForSets = await getPartsForSets(session, setIds);

  // A set's badges answer for the whole set, so every part counts, not just
  // the one standing at the front of the stack.
  const mediaIds = media.map((m) => m.id);
  const partIds = Object.values(partsForSets).flatMap((set) =>
    set.parts.map((part) => part.id),
  );
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(session, [
    ...mediaIds,
    ...partIds,
  ]);
  const savedForLater = await getSavedForLaterStatusForMedia(session, [
    ...mediaIds,
    ...partIds,
  ]);

  return media.map((media) => {
    const found = media.recordingGroupId
      ? partsForSets[media.recordingGroupId]
      : undefined;
    // A set whose other parts are not ready has nothing to stack, and a
    // one-part set is not a set -- it presents as the single recording it is.
    const set = found && found.parts.length >= 2 ? found : undefined;

    const representative = {
      ...media,
      book: {
        ...media.book,
        authors: authorsForBooks[media.book.id] || [],
      },
      narrators: narratorsForMedia[media.id] || [],
      playthroughStatus: playthroughStatuses[media.id] ?? null,
      isOnSavedShelf: savedForLater.has(media.id),
      set: set?.set ?? null,
    };

    if (!set) {
      return {
        kind: "single" as const,
        media: [representative],
        representative,
        setId: null,
      };
    }

    return {
      kind: "set" as const,
      // the representative carries details the bare part rows lack, so it
      // stands in for its own part rather than being fetched twice
      media: set.parts.map((part) =>
        part.id === representative.id
          ? representative
          : {
              ...representative,
              ...part,
              set: set.set,
              narrators: [],
              playthroughStatus: playthroughStatuses[part.id] ?? null,
              isOnSavedShelf: savedForLater.has(part.id),
            },
      ),
      representative,
      setId: set.set.id,
    };
  });
}

type RepresentativeRow = {
  id: string;
  recordingGroupId: string | null;
  book: { id: string; title: string };
};

/** Every ready part of the given sets, in part order, with the set itself. */
async function getPartsForSets(session: Session, setIds: string[]) {
  if (setIds.length === 0) return {};

  const rows = await getDb()
    .select({
      id: schema.media.id,
      partNumber: schema.media.partNumber,
      published: schema.media.published,
      recordingGroupId: schema.media.recordingGroupId,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
      set: {
        id: schema.recordingGroups.id,
        name: schema.recordingGroups.name,
        showLabel: schema.recordingGroups.showLabel,
        partsTotal: schema.recordingGroups.partsTotal,
        partWord: schema.recordingGroups.partWord,
        partWordPlural: schema.recordingGroups.partWordPlural,
      },
    })
    .from(schema.media)
    .innerJoin(
      schema.recordingGroups,
      and(
        eq(schema.recordingGroups.url, schema.media.url),
        eq(schema.recordingGroups.id, schema.media.recordingGroupId),
      ),
    )
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        inArray(schema.media.recordingGroupId, setIds),
      ),
    );

  const bySet: Record<string, { set: SetRow; parts: PartRow[] }> = {};

  for (const { set, ...part } of rows) {
    const entry = (bySet[set.id] ??= { set, parts: [] });
    entry.parts.push(part);
  }

  for (const entry of Object.values(bySet)) {
    entry.parts.sort(byPartOrder);
  }

  return bySet;
}

type SetRow = {
  id: string;
  name: string | null;
  showLabel: boolean;
  partsTotal: number | null;
  partWord: string | null;
  partWordPlural: string | null;
};

type PartRow = {
  id: string;
  partNumber: number | null;
  published: Date | null;
  recordingGroupId: string | null;
  thumbnails: Thumbnails | null;
  download: { thumbnails: DownloadedThumbnails | null } | null;
};

export async function getSearchedMedia(
  session: Session,
  limit: number,
  searchQuery: string,
) {
  const media = await searchMedia(session, limit, searchQuery);

  return withEditionDetails(session, media);
}

/**
 * The library listing collapses a set to a single entry.
 *
 * The collapse has to happen in SQL rather than after the fact: this list is
 * paged, and grouping a page's worth of rows afterwards would leave pages of
 * uneven length and could split a set across a page boundary. Only the first
 * ready part of each set survives the filter, which is the same representative
 * `toEditions` would have picked.
 */
async function recentMedia(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  return getDb()
    .select({
      id: schema.media.id,
      title: schema.media.title,
      thumbnails: schema.media.thumbnails,
      insertedAt: schema.media.insertedAt,
      recordingGroupId: schema.media.recordingGroupId,
      partNumber: schema.media.partNumber,
      published: schema.media.published,
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.media)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        or(
          isNull(schema.media.recordingGroupId),
          eq(schema.media.id, firstReadyPartOfSet),
        ),
        insertedBefore
          ? lt(schema.media.insertedAt, insertedBefore)
          : undefined,
      ),
    )
    .orderBy(desc(schema.media.insertedAt))
    .limit(limit);
}

// Part number ascending, nulls last, then id -- spelled out rather than using
// NULLS LAST so it does not depend on the SQLite version Expo ships.
const firstReadyPartOfSet = sql`(
  SELECT part.id FROM media part
  WHERE part.url = ${schema.media.url}
    AND part.recording_group_id = ${schema.media.recordingGroupId}
    AND part.status = 'ready'
  ORDER BY part.part_number IS NULL, part.part_number ASC, part.id ASC
  LIMIT 1
)`;

async function searchMedia(
  session: Session,
  limit: number,
  searchQuery: string,
) {
  return await getDb()
    .selectDistinct({
      id: schema.media.id,
      title: schema.media.title,
      thumbnails: schema.media.thumbnails,
      recordingGroupId: schema.media.recordingGroupId,
      partNumber: schema.media.partNumber,
      published: schema.media.published,
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.media)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .leftJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.books.url),
        eq(schema.bookAuthors.bookId, schema.books.id),
      ),
    )
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .leftJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.media.url),
        eq(schema.mediaNarrators.mediaId, schema.media.id),
      ),
    )
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.seriesBooks.url, schema.books.url),
        eq(schema.seriesBooks.bookId, schema.books.id),
      ),
    )
    .leftJoin(
      schema.series,
      and(
        eq(schema.series.url, schema.seriesBooks.url),
        eq(schema.series.id, schema.seriesBooks.seriesId),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        // one hit per set, same as the listing -- a set matching a search is
        // one result, not one per part
        or(
          isNull(schema.media.recordingGroupId),
          eq(schema.media.id, firstReadyPartOfSet),
        ),
        or(
          like(schema.books.title, `%${searchQuery}%`),
          like(schema.authors.name, `%${searchQuery}%`),
          like(schema.narrators.name, `%${searchQuery}%`),
          like(schema.series.name, `%${searchQuery}%`),
        ),
      ),
    )
    .orderBy(
      sql`
      CASE
        WHEN ${schema.books.title} LIKE ${`%${searchQuery}%`} THEN 1
        WHEN ${schema.series.name} LIKE ${`%${searchQuery}%`} THEN 2
        WHEN ${schema.authors.name} LIKE ${`%${searchQuery}%`} THEN 3
        WHEN ${schema.narrators.name} LIKE ${`%${searchQuery}%`} THEN 4
        ELSE 5
      END`,
      desc(schema.media.insertedAt),
    )
    .limit(limit);
}
