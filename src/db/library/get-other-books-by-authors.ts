import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { MediaHeaderInfo } from "./get-media-header-info";

export type AuthorsWithOtherBooks = Awaited<
  ReturnType<typeof getOtherBooksByAuthors>
>;
export type AuthorWithOtherBooks = AuthorsWithOtherBooks[number];

export async function getOtherBooksByAuthors(
  session: Session,
  book: MediaHeaderInfo["book"],
) {
  if (book.authors.length === 0) return [];

  const booksByAuthorId = await getBooksForAuthors(session, book);

  const bookIds = Object.values(booksByAuthorId).flatMap((books) =>
    books.map((b) => b.id),
  );
  const authors = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = mediaForBooks.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByBookId = Object.groupBy(mediaForBooks, (m) => m.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return book.authors.map((author) => ({
    ...author,
    books: (booksByAuthorId[author.id] ?? []).map((book) => ({
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

async function getBooksForAuthors(
  session: Session,
  book: MediaHeaderInfo["book"],
) {
  const authorIds = book.authors.map((a) => a.id);
  const withoutBookId = book.id;
  const withoutSeriesIds = book.series.map((s) => s.id);

  // NOTE: N+1 queries, but it's a small number of authors (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, Awaited<ReturnType<typeof getBooksForAuthor>>> = {};

  for (const authorId of authorIds) {
    map[authorId] = await getBooksForAuthor(
      session,
      authorId,
      withoutBookId,
      withoutSeriesIds,
    );
  }

  return map;
}

async function getBooksForAuthor(
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
