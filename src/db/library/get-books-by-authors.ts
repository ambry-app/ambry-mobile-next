import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type BooksByAuthorsType = Awaited<ReturnType<typeof getBooksByAuthors>>;

type Author = {
  id: string;
  name: string;
};

export async function getBooksByAuthors(session: Session, authors: Author[]) {
  const authorIds = authors.map((a) => a.id);
  const books = await getBooks(session, authorIds);

  const bookIds = books.map((b) => b.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const media = await getMediaForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const booksByAuthorId = Object.groupBy(books, (b) => b.authorId);
  const authorsByBookId = Object.groupBy(authorsForBooks, (a) => a.bookId);
  const mediaByBookId = Object.groupBy(media, (m) => m.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return authors.map((author) => ({
    ...author,
    books: (booksByAuthorId[author.id] ?? []).map(({ authorId, ...book }) => ({
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
  }));
}

async function getBooks(session: Session, authorIds: string[]) {
  if (authorIds.length === 0) return [];

  const books = await db
    .select({
      id: schema.books.id,
      title: schema.books.title,
      authorId: schema.bookAuthors.authorId,
    })
    .from(schema.bookAuthors)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.bookAuthors.url),
        eq(schema.books.id, schema.bookAuthors.bookId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        inArray(schema.bookAuthors.authorId, authorIds),
      ),
    )
    .orderBy(desc(schema.books.published));

  // Limit to 10 books per authorId
  // Doing it in JS right now because it's too hard to do window functions with drizzle-orm
  const grouped = Object.groupBy(books, (b) => b.authorId);
  return Object.values(grouped).flatMap((arr) => (arr ?? []).slice(0, 10));
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
