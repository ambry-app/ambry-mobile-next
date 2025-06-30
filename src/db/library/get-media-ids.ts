import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

export type MediaIds = Awaited<ReturnType<typeof getMediaIds>>;

/**
 * Retrieves related IDs for a given media item, including its book, authors, series, and narrators.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media item to look up.
 * @returns An object containing the mediaId, bookId, an array of authorIds, seriesIds, and narratorIds.
 * @throws If the media item is not found for the given session and mediaId.
 */
export async function getMediaIds(session: Session, mediaId: string) {
  const media = await getMedia(session, mediaId);
  const authorIds = await getAuthorIds(session, media.bookId);
  const seriesIds = await getSeriesIds(session, media.bookId);
  const narratorIds = await getNarratorIds(session, mediaId);

  return {
    mediaId,
    bookId: media.bookId,
    authorIds: authorIds,
    seriesIds: seriesIds,
    narratorIds: narratorIds,
  };
}

async function getMedia(session: Session, mediaId: string) {
  const mediaRows = await db
    .select({
      id: schema.media.id,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(mediaRows[0], "Media not found");
}

async function getAuthorIds(session: Session, bookId: string) {
  const bookAuthors = await db
    .select({ authorId: schema.bookAuthors.authorId })
    .from(schema.bookAuthors)
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    );

  return bookAuthors.map((ba) => ba.authorId);
}

async function getSeriesIds(session: Session, bookId: string) {
  const seriesBooks = await db
    .select({ seriesId: schema.seriesBooks.seriesId })
    .from(schema.seriesBooks)
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.bookId, bookId),
      ),
    );

  return seriesBooks.map((sb) => sb.seriesId);
}

export async function getNarratorIds(session: Session, mediaId: string) {
  const mediaNarrators = await db
    .select({ narratorId: schema.mediaNarrators.narratorId })
    .from(schema.mediaNarrators)
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    );

  return mediaNarrators.map((mn) => mn.narratorId);
}
