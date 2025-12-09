import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";
import { flatMapGroups } from "@/utils";

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

export async function getBooksByAuthors(
  session: Session,
  authors: Author[],
  booksLimit: number,
) {
  if (authors.length === 0) return [];

  const authorIds = authors.map((a) => a.id);
  const booksForAuthors = await getBooksForAuthors(
    session,
    authorIds,
    booksLimit,
  );

  const bookIds = flatMapGroups(booksForAuthors, (book) => book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  // NOTE: small improvement possible by missing out authors that have no books
  return authors.map((author) => ({
    ...author,
    books: booksForAuthors[author.id]!.map((book) => ({
      ...book,
      authors: authorsForBooks[book.id]!,
      media: (mediaForBooks[book.id] ?? []).map((media) => ({
        ...media,
        narrators: narratorsForMedia[media.id] ?? [],
      })),
    })),
  }));
}

async function getBooksForAuthors(
  session: Session,
  authorIds: string[],
  booksLimit: number,
) {
  // NOTE: N+1 queries, but it's a small number of authors (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, BooksForAuthor> = {};
  for (const authorId of authorIds) {
    map[authorId] = await getBooksForAuthor(session, authorId, booksLimit);
  }

  return map;
}

type BooksForAuthor = Awaited<ReturnType<typeof getBooksForAuthor>>;

async function getBooksForAuthor(
  session: Session,
  authorId: string,
  limit: number,
) {
  return getDb()
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
    .limit(limit);
}
