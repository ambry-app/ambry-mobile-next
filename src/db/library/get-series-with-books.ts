import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, eq, inArray, sql } from "drizzle-orm";
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

export async function getSeriesWithBooks(session: Session, series: Series[]) {
  if (series.length === 0) return [];

  const seriesIds = series.map((s) => s.id);
  const seriesBooks = await getSeriesBooks(session, seriesIds);

  const bookIds = seriesBooks.map((sb) => sb.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  const seriesBooksBySeriesId = Object.groupBy(
    seriesBooks,
    (sb) => sb.seriesId,
  );

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

async function getSeriesBooks(session: Session, seriesIds: string[]) {
  return db
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
        inArray(schema.seriesBooks.seriesId, seriesIds),
      ),
    )
    .orderBy(sql`CAST(book_number AS FLOAT)`);
}
