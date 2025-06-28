import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, eq, inArray } from "drizzle-orm";

export type MediaHeaderInfo = Awaited<ReturnType<typeof getMediaHeaderInfo>>;

/**
 * Retrieves comprehensive header information for a specific media item.
 *
 * This function gathers and returns detailed information about a media item,
 * including its metadata, download thumbnails, narrators, associated book details,
 * book authors, and series information.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media item to fetch information for.
 * @returns An object containing media metadata, download info, narrators, and nested book details (including authors and series).
 * @throws Will throw an error if any of the required entities (media, book, etc.) cannot be found.
 */
export async function getMediaHeaderInfo(session: Session, mediaId: string) {
  // 1. Fetch the media row
  const media = await getMedia(session, mediaId);

  // 2. Fetch download thumbnails
  const download = await getDownload(session, mediaId);

  // 3. Fetch media narrators (and their names)
  const narrators = await getNarrators(session, mediaId);

  // 4. Fetch book info
  const book = await getBook(session, media.bookId);

  // 5. Fetch book authors
  const authors = await getAuthors(session, book.id);

  // 6. Fetch seriesBooks (bookNumber, series name)
  const seriesBooks = await getSeriesBooks(session, book.id);

  return {
    ...media,
    download,
    narrators,
    book: {
      ...book,
      authors,
      seriesBooks,
    },
  };
}

async function getMedia(session: Session, mediaId: string) {
  const rows = await db
    .select({
      id: schema.media.id,
      fullCast: schema.media.fullCast,
      abridged: schema.media.abridged,
      thumbnails: schema.media.thumbnails,
      duration: schema.media.duration,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Media not found");
}

async function getDownload(session: Session, mediaId: string) {
  const rows = await db
    .select({ thumbnails: schema.downloads.thumbnails })
    .from(schema.downloads)
    .where(
      and(
        eq(schema.downloads.url, session.url),
        eq(schema.downloads.mediaId, mediaId),
      ),
    )
    .limit(1);

  return rows[0];
}

async function getNarrators(session: Session, mediaId: string) {
  const mediaNarrators = await db
    .select({
      narratorId: schema.mediaNarrators.narratorId,
    })
    .from(schema.mediaNarrators)
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    );

  const narratorIds = mediaNarrators.map((n) => n.narratorId);

  if (narratorIds.length === 0) {
    return [];
  }

  return await db
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
    })
    .from(schema.narrators)
    .where(
      and(
        eq(schema.narrators.url, session.url),
        inArray(schema.narrators.id, narratorIds),
      ),
    );
}

async function getBook(session: Session, bookId: string) {
  const rows = await db
    .select({
      id: schema.books.id,
      title: schema.books.title,
    })
    .from(schema.books)
    .where(and(eq(schema.books.url, session.url), eq(schema.books.id, bookId)))
    .limit(1);

  return requireValue(rows[0], "Book not found");
}

async function getAuthors(session: Session, bookId: string) {
  const bookAuthors = await db
    .select({
      authorId: schema.bookAuthors.authorId,
    })
    .from(schema.bookAuthors)
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    );

  const authorIds = bookAuthors.map((ba) => ba.authorId);

  if (authorIds.length === 0) {
    return [];
  }

  return db
    .select({ name: schema.authors.name })
    .from(schema.authors)
    .where(
      and(
        eq(schema.authors.url, session.url),
        inArray(schema.authors.id, authorIds),
      ),
    );
}

async function getSeriesBooks(session: Session, bookId: string) {
  const seriesBooks = await db
    .select({
      bookNumber: schema.seriesBooks.bookNumber,
      seriesId: schema.seriesBooks.seriesId,
    })
    .from(schema.seriesBooks)
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.bookId, bookId),
      ),
    );

  if (seriesBooks.length === 0) {
    return [];
  }

  const seriesIds = seriesBooks.map((sb) => sb.seriesId);
  const seriesList = await db
    .select({
      id: schema.series.id,
      name: schema.series.name,
    })
    .from(schema.series)
    .where(
      and(
        eq(schema.series.url, session.url),
        inArray(schema.series.id, seriesIds),
      ),
    );

  const seriesMap = Object.fromEntries(seriesList.map((s) => [s.id, s.name]));

  return seriesBooks.map((sb) => ({
    bookNumber: sb.bookNumber,
    seriesName: requireValue(seriesMap[sb.seriesId], "Series not found"),
  }));
}
