import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { MediaHeaderInfo } from "./get-media-header-info";
import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export type NarratorsWithOtherMedia = Awaited<
  ReturnType<typeof getOtherMediaByNarrators>
>;
export type NarratorWithOtherMedia = NarratorsWithOtherMedia[number];

export async function getOtherMediaByNarrators(
  session: Session,
  media: MediaHeaderInfo,
) {
  if (media.narrators.length === 0) return [];

  const mediaByNarratorId = await getMediaForNarrators(session, media);

  const bookIds = flatMapGroups(mediaByNarratorId, (media) => media.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaByNarratorId, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return media.narrators.map((narrator) => ({
    ...narrator,
    media: (mediaByNarratorId[narrator.id] ?? []).map((m) => ({
      ...m,
      narrators: narratorsForMedia[m.id] ?? [],
      book: {
        ...m.book,
        authors: authorsForBooks[m.book.id] ?? [],
      },
    })),
  }));
}

async function getMediaForNarrators(session: Session, media: MediaHeaderInfo) {
  if (media.narrators.length === 0) return {};

  const narratorIds = media.narrators.map((n) => n.id);
  const withoutMediaId = media.id;
  const withoutSeriesIds = media.book.series.map((s) => s.id);
  const withoutAuthorIds = media.book.authors.map((a) => a.id);

  // NOTE: N+1 queries, but it's a small number of narrators (usually 1) and it's easier than doing window functions/CTEs.
  // NOTE: full-cast recordings might make this heavy...
  let map: Record<string, MediaForNarrator[]> = {};

  for (const narratorId of narratorIds) {
    map[narratorId] = await getMediaForNarrator(
      session,
      narratorId,
      withoutMediaId,
      withoutSeriesIds,
      withoutAuthorIds,
    );
  }

  return map;
}

type MediaForNarrator = Awaited<ReturnType<typeof getMediaForNarrator>>[number];

async function getMediaForNarrator(
  session: Session,
  narratorId: string,
  withoutMediaId: string,
  withoutSeriesIds: string[],
  withoutAuthorIds: string[],
) {
  const results = await db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      authorIds: sql`json_group_array("book_authors"."author_id")`.as(
        "author_ids",
      ),
      seriesIds: sql`json_group_array("series_books"."series_id")`.as(
        "series_ids",
      ),
    })
    .from(schema.narrators)
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.narrators.url),
        eq(schema.mediaNarrators.narratorId, schema.narrators.id),
      ),
    )
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.mediaNarrators.url),
        eq(schema.media.id, schema.mediaNarrators.mediaId),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.books.url),
        eq(schema.bookAuthors.bookId, schema.books.id),
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
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
        ne(schema.media.id, withoutMediaId),
      ),
    )
    .groupBy(schema.media.id)
    .having(
      and(
        sql`not exists (select 1 from json_each(author_ids) where value in ${withoutAuthorIds})`,
        or(
          sql`series_ids is null`,
          sql`not exists (select 1 from json_each(series_ids) where value in ${withoutSeriesIds})`,
        ),
      ),
    )
    .orderBy(desc(schema.media.published))
    .limit(10);

  return results.map(({ authorIds, seriesIds, ...rest }) => rest);
}
