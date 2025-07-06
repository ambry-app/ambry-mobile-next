import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils/flat-map-groups";
import { and, desc, eq } from "drizzle-orm";
import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
} from "./shared-queries";

export type AuthorsWithBooks = Awaited<ReturnType<typeof getBooksByAuthors>>;
export type AuthorWithBooks = AuthorsWithBooks[number];

type Author = {
  id: string;
  name: string;
};

export async function getBooksByAuthors(session: Session, authors: Author[]) {
  if (authors.length === 0) return [];

  const authorIds = authors.map((a) => a.id);
  const booksByAuthorId = await getBooks(session, authorIds);

  const bookIds = flatMapGroups(booksByAuthorId, (book) => book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  // NOTE: small improvement possible by missing out authors that have no books
  return authors.map((author) => ({
    ...author,
    books: (booksByAuthorId[author.id] ?? []).map((book) => ({
      ...book,
      authors: (authorsForBooks[book.id] ?? []).map(
        ({ bookId, ...author }) => author,
      ),
      media: (mediaForBooks[book.id] ?? []).map(({ bookId, ...media }) => ({
        ...media,
        narrators: (narratorsForMedia[media.id] ?? []).map(
          ({ mediaId, ...narrator }) => narrator,
        ),
      })),
    })),
  }));
}

async function getBooks(session: Session, authorIds: string[]) {
  // NOTE: N+1 queries, but it's a small number of authors (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, Awaited<ReturnType<typeof getBooksForAuthor>>> = {};
  for (const authorId of authorIds) {
    map[authorId] = await getBooksForAuthor(session, authorId);
  }

  return map;
}

async function getBooksForAuthor(session: Session, authorId: string) {
  return db
    .select({
      id: schema.books.id,
      title: schema.books.title,
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
        eq(schema.bookAuthors.authorId, authorId),
      ),
    )
    .orderBy(desc(schema.books.published))
    .limit(10);
}
