import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import "core-js/actual/object/group-by";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

export type SeriesWithBooks = Awaited<ReturnType<typeof getSeriesWithBooks>>;

/**
 * Retrieves detailed information about a book series, including its books,
 * authors, and associated media.
 *
 * @param session - The current user session containing the URL context.
 * @param seriesId - The unique identifier of the series to retrieve.
 * @returns A promise that resolves to an object containing the series data and an array of books in the series,
 *          each with their respective authors and media. If the series has no books, returns the series with an empty `seriesBooks` array.
 * @throws If the series with the given ID is not found.
 */
export async function getSeriesWithBooks(session: Session, seriesId: string) {
  const series = await getSeries(session, seriesId);

  const seriesBooks = await getSeriesBooks(session, seriesId);
  if (seriesBooks.length === 0) return { ...series, seriesBooks: [] };

  const bookIds = seriesBooks.map((sb) => sb.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);
  const media = await getMediaForBooks(session, bookIds);
  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByBookId = Object.groupBy(media, (m) => m.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return {
    ...series,
    seriesBooks: seriesBooks.map((sb) => ({
      ...sb,
      book: {
        ...sb.book,
        authors: authorsByBookId[sb.book.id] ?? [],
        media: (mediaByBookId[sb.book.id] ?? []).map((m) => ({
          ...m,
          narrators: narratorsByMediaId[m.id] ?? [],
        })),
      },
    })),
  };
}

async function getSeries(session: Session, seriesId: string) {
  const series = await db.query.series.findFirst({
    where: and(
      eq(schema.series.url, session.url),
      eq(schema.series.id, seriesId),
    ),
    columns: { id: true, name: true },
  });

  return requireValue(series, "Series not found");
}

async function getSeriesBooks(session: Session, seriesId: string) {
  return db
    .select({
      id: schema.seriesBooks.id,
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
        eq(schema.seriesBooks.url, schema.books.url),
        eq(schema.seriesBooks.bookId, schema.books.id),
      ),
    )
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.seriesId, seriesId),
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
        eq(schema.bookAuthors.url, schema.authors.url),
        eq(schema.bookAuthors.authorId, schema.authors.id),
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
        eq(schema.media.url, schema.downloads.url),
        eq(schema.media.id, schema.downloads.mediaId),
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

async function getNarratorsForMedia(session: Session, mediaIds: string[]) {
  if (mediaIds.length === 0) return [];

  return db
    .select({
      mediaId: schema.mediaNarrators.mediaId,
      name: schema.narrators.name,
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.mediaNarrators.url, schema.narrators.url),
        eq(schema.mediaNarrators.narratorId, schema.narrators.id),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}
