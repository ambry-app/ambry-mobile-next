import { and, asc, eq, gt, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { flatMapGroups } from "@/utils/flat-map-groups";

import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
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
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );
  const savedForLater = await getSavedForLaterStatusForMedia(session, mediaIds);

  return seriesBooks.map((seriesBook) => ({
    ...seriesBook,
    book: {
      ...seriesBook.book,
      authors: authorsForBooks[seriesBook.book.id] ?? [],
      media: (mediaForBooks[seriesBook.book.id] ?? []).map((media) => ({
        ...media,
        narrators: narratorsForMedia[media.id] ?? [],
        playthroughStatus: playthroughStatuses[media.id] ?? null,
        isOnSavedShelf: savedForLater.has(media.id),
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
  return getDb()
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
