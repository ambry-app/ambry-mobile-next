import { and, desc, eq, isNull, lt, ne } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export async function getPlaythroughsPage(
  session: Session,
  limit: number,
  status: schema.PlaythroughStatus,
  withoutPlaythroughId?: string | null,
  cursorBefore?: Date,
) {
  const playthroughs = await getPlaythroughs(
    session,
    limit,
    status,
    withoutPlaythroughId,
    cursorBefore,
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
  withoutPlaythroughId?: string | null,
  cursorBefore?: Date,
) {
  // Determine sort/cursor field based on status:
  // - in_progress: sort by lastEventAt (when user last listened)
  // - finished: sort by finishedAt (when user finished)
  // - abandoned: sort by abandonedAt (when user abandoned)
  const getSortField = () => {
    switch (status) {
      case "in_progress":
        return schema.playthroughs.lastEventAt;
      case "finished":
        return schema.playthroughs.finishedAt;
      case "abandoned":
        return schema.playthroughs.abandonedAt;
    }
  };

  const sortField = getSortField();

  const playthroughs = await getDb()
    .select({
      id: schema.playthroughs.id,
      status: schema.playthroughs.status,
      startedAt: schema.playthroughs.startedAt,
      finishedAt: schema.playthroughs.finishedAt,
      refreshedAt: schema.playthroughs.refreshedAt,
      // State from playthrough (position, rate, last event time)
      position: schema.playthroughs.position,
      playbackRate: schema.playthroughs.playbackRate,
      lastListenedAt: schema.playthroughs.lastEventAt,
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
        withoutPlaythroughId
          ? ne(schema.playthroughs.id, withoutPlaythroughId)
          : undefined,
        cursorBefore ? lt(sortField, cursorBefore) : undefined,
      ),
    )
    .orderBy(desc(sortField))
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
