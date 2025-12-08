import { and, desc, eq, like, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";

import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export type MediaPage = Awaited<ReturnType<typeof getMediaPage>>;

export type MediaSearchResult = Awaited<ReturnType<typeof getSearchedMedia>>;

export async function getMediaPage(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  const media = await recentMedia(session, limit, insertedBefore);

  const bookIds = media.map((m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] || [],
    },
    narrators: narratorsForMedia[media.id] || [],
  }));
}

export async function getSearchedMedia(
  session: Session,
  limit: number,
  searchQuery: string,
) {
  const media = await searchMedia(session, limit, searchQuery);

  const bookIds = media.map((m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] || [],
    },
    narrators: narratorsForMedia[media.id] || [],
  }));
}

async function recentMedia(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  return getDb()
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
  return await getDb()
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
    .leftJoin(
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
