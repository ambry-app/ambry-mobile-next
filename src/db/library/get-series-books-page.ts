import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
} from "./shared-queries";

export async function getSeriesBooksPage(
  session: Session,
  seriesId: string,
  limit: number,
  bookNumberAfter?: string,
) {
  const seriesBooks = await getSeriesBooks(
    session,
    seriesId,
    limit,
    bookNumberAfter,
  );

  const bookIds = seriesBooks.map((sb) => sb.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return seriesBooks.map((seriesBook) => ({
    ...seriesBook,
    book: {
      ...seriesBook.book,
      authors: authorsForBooks[seriesBook.book.id] ?? [],
      media: (mediaForBooks[seriesBook.book.id] ?? []).map((media) => ({
        ...media,
        narrators: narratorsForMedia[media.id] ?? [],
      })),
    },
  }));
}

async function getSeriesBooks(
  session: Session,
  seriesId: string,
  limit: number,
  bookNumberAfter?: string,
) {
  return db
    .select({
      id: schema.seriesBooks.id,
      bookNumber: schema.seriesBooks.bookNumber,
      book: {
        id: schema.books.id,
        title: schema.books.title,
        published: schema.books.published,
      },
    })
    .from(schema.seriesBooks)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.seriesBooks.url),
        eq(schema.books.id, schema.seriesBooks.bookId),
      ),
    )
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.seriesId, seriesId),
        bookNumberAfter !== undefined
          ? gt(
              sql`CAST(${schema.seriesBooks.bookNumber} AS FLOAT)`,
              bookNumberAfter,
            )
          : undefined,
      ),
    )
    .orderBy(asc(sql`CAST(${schema.seriesBooks.bookNumber} AS FLOAT)`))
    .limit(limit);
}
