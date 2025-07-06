import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getNarratorsForMedia } from "./shared-queries";

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
  const authors = await getAuthorsForBooks(session, bookIds);
  const media = await getMediaForBooks(session, bookIds);
  const mediaIds = media.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  const seriesBooksBySeriesId = Object.groupBy(
    seriesBooks,
    (sb) => sb.seriesId,
  );
  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByBookId = Object.groupBy(media, (m) => m.bookId);

  // NOTE: small improvement possible by missing out series that have no books
  return series.map((series) => ({
    ...series,
    seriesBooks: (seriesBooksBySeriesId[series.id] ?? []).map(
      ({ seriesId, ...seriesBook }) => ({
        ...seriesBook,
        book: {
          ...seriesBook.book,
          authors: (authorsByBookId[seriesBook.book.id] ?? []).map(
            ({ bookId, ...author }) => author,
          ),
          media: (mediaByBookId[seriesBook.book.id] ?? []).map(
            ({ bookId, ...media }) => ({
              ...media,
              narrators: (narratorsForMedia[media.id] ?? []).map(
                ({ mediaId, ...narrator }) => narrator,
              ),
            }),
          ),
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

async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return [];

  return db
    .select({
      bookId: schema.bookAuthors.bookId,
      name: schema.authors.name,
    })
    .from(schema.bookAuthors)
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        inArray(schema.bookAuthors.bookId, bookIds),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));
}

async function getMediaForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return [];

  return db
    .select({
      id: schema.media.id,
      bookId: schema.media.bookId,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
    })
    .from(schema.media)
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
        inArray(schema.media.bookId, bookIds),
      ),
    )
    .orderBy(desc(schema.media.published));
}
