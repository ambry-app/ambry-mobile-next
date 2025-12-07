import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export async function getPlaythroughsPage(
  session: Session,
  limit: number,
  status: schema.PlaythroughStatus,
  withoutMediaId?: string | null,
  updatedBefore?: Date,
) {
  const playthroughs = await getPlaythroughs(
    session,
    limit,
    status,
    withoutMediaId,
    updatedBefore,
  );

  const mediaIds = playthroughs.map((p) => p.media.id);
  const bookIds = playthroughs.map((p) => p.media.book.id);

  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return playthroughs.map((p) => ({
    ...p,
    media: {
      ...p.media,
      book: {
        ...p.media.book,
        authors: authorsForBooks[p.media.book.id] || [],
      },
      narrators: narratorsForMedia[p.media.id] || [],
    },
  }));
}

async function getPlaythroughs(
  session: Session,
  limit: number,
  status: schema.PlaythroughStatus,
  withoutMediaId?: string | null,
  updatedBefore?: Date,
) {
  const playthroughs = await getDb()
    .select({
      id: schema.playthroughs.id,
      status: schema.playthroughs.status,
      startedAt: schema.playthroughs.startedAt,
      finishedAt: schema.playthroughs.finishedAt,
      updatedAt: schema.playthroughs.updatedAt,
      // State from cache (position, rate, last event time)
      position: sql<number>`COALESCE(${schema.playthroughStateCache.currentPosition}, 0)`,
      playbackRate: sql<number>`COALESCE(${schema.playthroughStateCache.currentRate}, 1)`,
      lastListenedAt: schema.playthroughStateCache.lastEventAt,
      media: {
        id: schema.media.id,
        thumbnails: schema.media.thumbnails,
        duration: schema.media.duration,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.playthroughs)
    .leftJoin(
      schema.playthroughStateCache,
      eq(schema.playthroughStateCache.playthroughId, schema.playthroughs.id),
    )
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.playthroughs.url),
        eq(schema.media.id, schema.playthroughs.mediaId),
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
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.userEmail, session.email),
        eq(schema.playthroughs.status, status),
        isNull(schema.playthroughs.deletedAt),
        withoutMediaId
          ? ne(schema.playthroughs.mediaId, withoutMediaId)
          : undefined,
        updatedBefore
          ? lt(schema.playthroughs.updatedAt, updatedBefore)
          : undefined,
      ),
    )
    .orderBy(desc(schema.playthroughs.updatedAt))
    .limit(limit);

  return playthroughs.map(({ book, download, ...p }) => ({
    ...p,
    media: {
      ...p.media,
      book,
      download,
    },
  }));
}

export type PlaythroughWithMedia = Awaited<
  ReturnType<typeof getPlaythroughsPage>
>[number];
