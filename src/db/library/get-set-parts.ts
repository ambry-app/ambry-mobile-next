import { and, asc, eq, ne } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

import {
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
} from "./shared-queries";

export type SetParts = Awaited<ReturnType<typeof getSetParts>>;

/**
 * The recordings in a set, in reading order. `excludeMediaId` leaves out the
 * recording the reader is already looking at, so a media screen can show "the
 * rest of this set" without repeating itself.
 */
export async function getSetParts(
  session: Session,
  setId: string,
  options: { excludeMediaId?: string; limit?: number } = {},
) {
  const { excludeMediaId, limit } = options;

  const query = getDb()
    .select({
      id: schema.media.id,
      title: schema.media.title,
      partNumber: schema.media.partNumber,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
      book: {
        id: schema.books.id,
        title: schema.books.title,
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
        eq(schema.media.recordingGroupId, setId),
        excludeMediaId ? ne(schema.media.id, excludeMediaId) : undefined,
      ),
    )
    .orderBy(asc(schema.media.partNumber));

  const parts = limit ? await query.limit(limit) : await query;

  const mediaIds = parts.map((part) => part.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );
  const savedForLater = await getSavedForLaterStatusForMedia(session, mediaIds);

  return parts.map((part) => ({
    ...part,
    narrators: narrators[part.id] || [],
    playthroughStatus: playthroughStatuses[part.id] ?? null,
    isOnSavedShelf: savedForLater.has(part.id),
  }));
}

/** How many recordings a set actually holds on this device. */
export async function getSetPartCount(session: Session, setId: string) {
  const rows = await getDb()
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.recordingGroupId, setId),
      ),
    );

  return rows.length;
}
