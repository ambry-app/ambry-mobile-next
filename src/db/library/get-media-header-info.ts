import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, eq } from "drizzle-orm";

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
 * @throws Will throw an error if the media entity cannot be found.
 */
export async function getMediaHeaderInfo(session: Session, mediaId: string) {
  const media = await getMedia(session, mediaId);
  const narrators = await getNarrators(session, mediaId);
  const authors = await getAuthors(session, media.book.id);
  const series = await getSeries(session, media.book.id);

  return {
    ...media,
    narrators,
    book: {
      ...media.book,
      authors,
      series,
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
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Media not found");
}

async function getNarrators(session: Session, mediaId: string) {
  return await db
    .select({ name: schema.narrators.name })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}

async function getAuthors(session: Session, bookId: string) {
  return db
    .select({ name: schema.authors.name })
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
        eq(schema.bookAuthors.bookId, bookId),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));
}

async function getSeries(session: Session, bookId: string) {
  return await db
    .select({
      bookNumber: schema.seriesBooks.bookNumber,
      name: schema.series.name,
    })
    .from(schema.seriesBooks)
    .innerJoin(
      schema.series,
      and(
        eq(schema.series.url, schema.seriesBooks.url),
        eq(schema.series.id, schema.seriesBooks.seriesId),
      ),
    )
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.bookId, bookId),
      ),
    );
}
