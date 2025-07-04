import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

export type AuthorWithOtherBooks = Awaited<
  ReturnType<typeof getAuthorWithOtherBooks>
>;

/**
 * Retrieves an author along with their other books, excluding a specific book and series.
 *
 * @param session - The current user session containing the URL context.
 * @param authorId - The ID of the author to retrieve.
 * @param withoutBookId - The ID of the book to exclude from the results.
 * @param withoutSeriesIds - An array of series IDs to exclude books from.
 * @returns A promise that resolves to the author object with their other books, including associated authors, media, and narrators,
 *          or `null` if the author has no other books.
 */
export async function getAuthorWithOtherBooks(
  session: Session,
  authorId: string,
  withoutBookId: string,
  withoutSeriesIds: string[],
) {
  const books = await getBooks(
    session,
    authorId,
    withoutBookId,
    withoutSeriesIds,
  );

  if (books.length === 0) return null;

  const author = await getAuthor(session, authorId);

  const bookIds = books.map((b) => b.id);
  const authors = await getAuthorsForBooks(session, bookIds);
  const media = await getMediaForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByBookId = Object.groupBy(media, (m) => m.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return {
    ...author,
    books: books.map((book) => ({
      ...book,
      authors: (authorsByBookId[book.id] ?? []).map(
        ({ bookId, ...author }) => author,
      ),
      media: (mediaByBookId[book.id] ?? []).map(({ bookId, ...media }) => ({
        ...media,
        narrators: (narratorsByMediaId[media.id] ?? []).map(
          ({ mediaId, ...narrator }) => narrator,
        ),
      })),
    })),
  };
}

async function getAuthor(session: Session, authorId: string) {
  const rows = await db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
      },
    })
    .from(schema.authors)
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.authors.url),
        eq(schema.people.id, schema.authors.personId),
      ),
    )
    .where(
      and(eq(schema.authors.url, session.url), eq(schema.authors.id, authorId)),
    )
    .limit(1);

  return requireValue(rows[0], `Author with ID ${authorId} not found`);
}

async function getBooks(
  session: Session,
  authorId: string,
  withoutBookId: string,
  withoutSeriesIds: string[],
) {
  const results = await db
    .select({
      id: schema.books.id,
      title: schema.books.title,
      seriesIds: sql`json_group_array("series_books"."series_id")`.as(
        "series_ids",
      ),
    })
    .from(schema.authors)
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.authors.url),
        eq(schema.bookAuthors.authorId, schema.authors.id),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.bookAuthors.url),
        eq(schema.books.id, schema.bookAuthors.bookId),
      ),
    )
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.seriesBooks.url, schema.books.url),
        eq(schema.seriesBooks.bookId, schema.books.id),
      ),
    )
    .where(
      and(
        eq(schema.authors.url, session.url),
        eq(schema.authors.id, authorId),
        ne(schema.books.id, withoutBookId),
      ),
    )
    .groupBy(schema.books.id)
    .having(
      or(
        sql`series_ids is null`,
        sql`not exists (select 1 from json_each(series_ids) where value in ${withoutSeriesIds})`,
      ),
    )
    .orderBy(desc(schema.books.published))
    .limit(10);

  return results.map(({ seriesIds, ...rest }) => rest);
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
