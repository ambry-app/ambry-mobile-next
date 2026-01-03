import { and, desc, eq, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { flatMapGroups } from "@/utils";

import { MediaHeaderInfo } from "./get-media-header-info";
import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
} from "./shared-queries";

export type AuthorsWithOtherBooks = Awaited<
  ReturnType<typeof getOtherBooksByAuthors>
>;
export type AuthorWithOtherBooks = AuthorsWithOtherBooks[number];

export async function getOtherBooksByAuthors(
  session: Session,
  book: MediaHeaderInfo["book"],
  booksLimit: number,
) {
  if (book.authors.length === 0) return [];

  const booksByAuthorId = await getBooksForAuthors(session, book, booksLimit);

  const bookIds = flatMapGroups(booksByAuthorId, (book) => book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );
  const savedForLater = await getSavedForLaterStatusForMedia(session, mediaIds);

  return book.authors.map((author) => ({
    ...author,
    books: (booksByAuthorId[author.id] ?? []).map((book) => ({
      ...book,
      authors: authorsForBooks[book.id] ?? [],
      media: (mediaForBooks[book.id] ?? []).map((media) => ({
        ...media,
        narrators: narratorsForMedia[media.id] ?? [],
        playthroughStatus: playthroughStatuses[media.id] ?? null,
        isOnSavedShelf: savedForLater.has(media.id),
      })),
    })),
  }));
}

async function getBooksForAuthors(
  session: Session,
  book: MediaHeaderInfo["book"],
  booksLimit: number,
) {
  if (book.authors.length === 0) return {};

  const authorIds = book.authors.map((a) => a.id);
  const withoutBookId = book.id;
  const withoutSeriesIds = book.series.map((s) => s.id);

  // NOTE: N+1 queries, but it's a small number of authors (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, BooksForAuthor[]> = {};

  for (const authorId of authorIds) {
    map[authorId] = await getBooksForAuthor(
      session,
      authorId,
      withoutBookId,
      withoutSeriesIds,
      booksLimit,
    );
  }

  return map;
}

type BooksForAuthor = Awaited<ReturnType<typeof getBooksForAuthor>>[number];

async function getBooksForAuthor(
  session: Session,
  authorId: string,
  withoutBookId: string,
  withoutSeriesIds: string[],
  limit: number,
) {
  const results = await getDb()
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
    .limit(limit);

  return results.map(({ seriesIds, ...rest }) => rest);
}
