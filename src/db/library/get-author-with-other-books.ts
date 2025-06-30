import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import "core-js/actual/object/group-by";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
} from "drizzle-orm";

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
      authors: authorsByBookId[book.id] ?? [],
      media: (mediaByBookId[book.id] ?? []).map((m) => ({
        ...m,
        narrators: narratorsByMediaId[m.id] ?? [],
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
        eq(schema.authors.url, schema.people.url),
        eq(schema.authors.personId, schema.people.id),
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
  return await db
    .selectDistinct({ id: schema.books.id, title: schema.books.title })
    .from(schema.authors)
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.bookAuthors.url, schema.books.url),
        eq(schema.bookAuthors.bookId, schema.books.id),
      ),
    )
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.books.url, schema.seriesBooks.url),
        eq(schema.books.id, schema.seriesBooks.bookId),
      ),
    )
    .where(
      and(
        eq(schema.authors.url, session.url),
        eq(schema.authors.id, authorId),
        ne(schema.books.id, withoutBookId),
        or(
          isNull(schema.seriesBooks.seriesId),
          notInArray(schema.seriesBooks.seriesId, withoutSeriesIds),
        ),
      ),
    )
    .orderBy(desc(schema.books.published))
    .limit(10);
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
