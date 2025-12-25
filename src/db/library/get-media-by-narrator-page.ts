import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";

import {
  getAuthorsForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
} from "./shared-queries";

export async function getMediaByNarratorPage(
  session: Session,
  narratorId: string,
  limit: number,
  publishedBefore?: Date,
) {
  const media = await getMedia(session, narratorId, limit, publishedBefore);

  if (media.length === 0) return [];

  const mediaIds = media.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );

  const bookIds = media.map((media) => media.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] ?? [],
    },
    narrators: narratorsForMedia[media.id] ?? [],
    playthroughStatus: playthroughStatuses[media.id] ?? null,
  }));
}

async function getMedia(
  session: Session,
  narratorId: string,
  limit: number,
  publishedBefore?: Date,
) {
  const publishedExpr = sql<Date>`COALESCE(${schema.media.published}, ${schema.books.published})`;

  return getDb()
    .select({
      id: schema.media.id,
      published: publishedExpr,
      thumbnails: schema.media.thumbnails,
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.mediaNarrators.url),
        eq(schema.media.id, schema.mediaNarrators.mediaId),
      ),
    )
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
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.narratorId, narratorId),
        publishedBefore
          ? sql`${publishedExpr} < ${publishedBefore}`
          : undefined,
      ),
    )
    .orderBy(desc(publishedExpr))
    .limit(limit);
}
