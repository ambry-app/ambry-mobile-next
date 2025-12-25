import { and, desc, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";

import { MediaHeaderInfo } from "./get-media-header-info";
import {
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
} from "./shared-queries";

export type BookOtherEditions = Awaited<
  ReturnType<typeof getBookOtherEditions>
>;

export async function getBookOtherEditions(
  session: Session,
  media: MediaHeaderInfo,
  limit: number,
) {
  const { book } = media;
  const otherMedia = await getOtherMedia(session, book.id, media.id, limit);

  if (otherMedia.length === 0) return null;

  const mediaIds = otherMedia.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );

  return {
    ...book,
    media: otherMedia.map((media) => ({
      ...media,
      narrators: narratorsForMedia[media.id] ?? [],
      playthroughStatus: playthroughStatuses[media.id] ?? null,
    })),
  };
}

async function getOtherMedia(
  session: Session,
  bookId: string,
  withoutMediaId: string,
  limit: number,
) {
  return getDb()
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.media)
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.bookId, bookId),
        ne(schema.media.id, withoutMediaId),
      ),
    )
    .orderBy(
      desc(sql`COALESCE(${schema.media.published}, ${schema.books.published})`),
    )
    .limit(limit);
}
