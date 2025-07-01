import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";

export type MediaPage = Awaited<ReturnType<typeof getMediaPage>>;

export type MediaSearchResult = Awaited<ReturnType<typeof getSearchedMedia>>;

/**
 * Returns a paginated list of media items, each with its related book (including authors) and narrators.
 *
 * @param session - The current user session containing the URL context.
 * @param limit - The maximum number of media items to fetch.
 * @param insertedBefore - (Optional) Only include media inserted before this date.
 * @returns A promise that resolves to an array of media items with related book and narrator details.
 */
export async function getMediaPage(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  const media = await recentMedia(session, limit, insertedBefore);

  const bookIds = media.map((m) => m.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: (authorsByBookId[media.book.id] || []).map(
        ({ bookId, ...author }) => author,
      ),
    },
    narrators: (narratorsByMediaId[media.id] || []).map(
      ({ mediaId, ...narrator }) => narrator,
    ),
  }));
}

export async function getSearchedMedia(
  session: Session,
  limit: number,
  searchQuery: string,
) {
  const media = await searchMedia(session, limit, searchQuery);

  const bookIds = media.map((m) => m.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: (authorsByBookId[media.book.id] || []).map(
        ({ bookId, ...author }) => author,
      ),
    },
    narrators: (narratorsByMediaId[media.id] || []).map(
      ({ mediaId, ...narrator }) => narrator,
    ),
  }));
}

async function recentMedia(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  return db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      insertedAt: schema.media.insertedAt,
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
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        insertedBefore
          ? lt(schema.media.insertedAt, insertedBefore)
          : undefined,
      ),
    )
    .orderBy(desc(schema.media.insertedAt))
    .limit(limit);
}

async function searchMedia(
  session: Session,
  limit: number,
  searchQuery: string,
) {
  return await db
    .selectDistinct({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
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
    .leftJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.books.url),
        eq(schema.bookAuthors.bookId, schema.books.id),
      ),
    )
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .leftJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.media.url),
        eq(schema.mediaNarrators.mediaId, schema.media.id),
      ),
    )
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .leftJoin(
      schema.seriesBooks,
      and(
        eq(schema.seriesBooks.url, schema.books.url),
        eq(schema.seriesBooks.bookId, schema.books.id),
      ),
    )
    .innerJoin(
      schema.series,
      and(
        eq(schema.series.url, schema.seriesBooks.url),
        eq(schema.series.id, schema.seriesBooks.seriesId),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        or(
          like(schema.books.title, `%${searchQuery}%`),
          like(schema.authors.name, `%${searchQuery}%`),
          like(schema.narrators.name, `%${searchQuery}%`),
          like(schema.series.name, `%${searchQuery}%`),
        ),
      ),
    )
    .orderBy(
      sql`
      CASE
        WHEN ${schema.books.title} LIKE ${`%${searchQuery}%`} THEN 1
        WHEN ${schema.series.name} LIKE ${`%${searchQuery}%`} THEN 2
        WHEN ${schema.authors.name} LIKE ${`%${searchQuery}%`} THEN 3
        WHEN ${schema.narrators.name} LIKE ${`%${searchQuery}%`} THEN 4
        ELSE 5
      END`,
      desc(schema.media.insertedAt),
    )
    .limit(limit);
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
