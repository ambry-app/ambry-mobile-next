import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, eq, sql } from "drizzle-orm";
import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
} from "./shared-queries";

export type SeriesWithBooks = Awaited<ReturnType<typeof getSeriesWithBooks>>;

type Series = {
  id: string;
  name: string;
};

export async function getSeriesWithBooks(
  session: Session,
  series: Series[],
  limit: number,
) {
  if (series.length === 0) return [];

  const seriesIds = series.map((s) => s.id);
  const seriesBooksBySeriesId = await getSeriesBooks(session, seriesIds, limit);

  const bookIds = flatMapGroups(seriesBooksBySeriesId, (sb) => sb.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  // NOTE: small improvement possible by missing out series that have no books
  return series.map((series) => ({
    ...series,
    seriesBooks: (seriesBooksBySeriesId[series.id] ?? []).map(
      ({ seriesId, ...seriesBook }) => ({
        ...seriesBook,
        book: {
          ...seriesBook.book,
          authors: authorsForBooks[seriesBook.book.id] ?? [],
          media: (mediaForBooks[seriesBook.book.id] ?? []).map((media) => ({
            ...media,
            narrators: narratorsForMedia[media.id] ?? [],
          })),
        },
      }),
    ),
  }));
}

async function getSeriesBooks(
  session: Session,
  seriesIds: string[],
  limit: number,
) {
  // NOTE: N+1 queries, but it's a small number of series (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, SeriesBooks> = {};
  for (const seriesId of seriesIds) {
    map[seriesId] = await getSeriesBooksForSeries(session, seriesId, limit);
  }

  return map;
}

type SeriesBooks = Awaited<ReturnType<typeof getSeriesBooksForSeries>>;

async function getSeriesBooksForSeries(
  session: Session,
  seriesId: string,
  limit: number,
) {
  return getDb()
    .select({
      id: schema.seriesBooks.id,
      seriesId: schema.seriesBooks.seriesId,
      bookNumber: schema.seriesBooks.bookNumber,
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.seriesBooks)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.seriesBooks.url),
        eq(schema.books.id, schema.seriesBooks.bookId),
      ),
    )
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.seriesId, seriesId),
      ),
    )
    .orderBy(sql`CAST(book_number AS FLOAT)`)
    .limit(limit);
}
