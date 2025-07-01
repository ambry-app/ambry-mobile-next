import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

export type NarratorWithOtherMedia = Awaited<
  ReturnType<typeof getNarratorWithOtherMedia>
>;

/**
 * Retrieves a narrator along with their other media, excluding a specific media and series/authors.
 *
 * @param session - The current user session containing the URL context.
 * @param narratorId - The ID of the narrator to retrieve.
 * @param withoutMediaId - The ID of the media to exclude from the results.
 * @param withoutSeriesIds - An array of series IDs to exclude media from.
 * @param withoutAuthorIds - An array of author IDs to exclude media from.
 * @returns A promise that resolves to the narrator object with their other media, including associated book, authors, and downloads,
 *          or `null` if the narrator has no other media.
 */
export async function getNarratorWithOtherMedia(
  session: Session,
  narratorId: string,
  withoutMediaId: string,
  withoutSeriesIds: string[],
  withoutAuthorIds: string[],
) {
  const media = await getMedia(
    session,
    narratorId,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  );

  if (media.length === 0) return null;

  const narrator = await getNarrator(session, narratorId);

  const bookIds = media.map((m) => m.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return {
    ...narrator,
    media: media.map((m) => ({
      ...m,
      narrators: (narratorsByMediaId[m.id] ?? []).map(
        ({ mediaId, ...narrator }) => narrator,
      ),
      book: {
        ...m.book,
        authors: (authorsByBookId[m.book.id] ?? []).map(
          ({ bookId, ...author }) => author,
        ),
      },
    })),
  };
}

async function getNarrator(session: Session, narratorId: string) {
  const rows = await db
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
      },
    })
    .from(schema.narrators)
    .innerJoin(
      schema.people,
      and(
        eq(schema.narrators.url, schema.people.url),
        eq(schema.narrators.personId, schema.people.id),
      ),
    )
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.id, narratorId),
      ),
    )
    .limit(1);

  return requireValue(rows[0], `Narrator with ID ${narratorId} not found`);
}

async function getMedia(
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
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
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
