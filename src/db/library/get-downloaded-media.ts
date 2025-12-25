import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";

import {
  getAuthorsForBooks,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
} from "./shared-queries";

export type DownloadedMedia = Awaited<
  ReturnType<typeof getDownloadedMedia>
>[number];

export async function getDownloadedMedia(session: Session, mediaIds: string[]) {
  if (mediaIds.length === 0) return [];

  const media = await getDownloadedMediaByIds(session, mediaIds);

  const bookIds = media.map((m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] || [],
    },
    narrators: narratorsForMedia[media.id] || [],
    playthroughStatus: playthroughStatuses[media.id] ?? null,
  }));
}

async function getDownloadedMediaByIds(session: Session, mediaIds: string[]) {
  return getDb()
    .select({
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
    .innerJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        inArray(schema.media.id, mediaIds),
      ),
    )
    .orderBy(desc(schema.downloads.downloadedAt));
}
