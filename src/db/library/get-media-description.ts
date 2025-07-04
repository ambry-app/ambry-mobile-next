import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

export type MediaDescription = Awaited<ReturnType<typeof getMediaDescription>>;

/**
 * Retrieves the description and related metadata for a specific media item,
 * along with its associated book information, from the database.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media item to fetch.
 * @returns An object containing the media's description, publication details, publisher, notes, bookId,
 *          and the associated book's publication information.
 * @throws If the media or associated book is not found in the database.
 */
export async function getMediaDescription(session: Session, mediaId: string) {
  return await getMedia(session, mediaId);
}

async function getMedia(session: Session, mediaId: string) {
  const mediaRows = await db
    .select({
      description: schema.media.description,
      published: schema.media.published,
      publishedFormat: schema.media.publishedFormat,
      publisher: schema.media.publisher,
      notes: schema.media.notes,
      book: {
        published: schema.books.published,
        publishedFormat: schema.books.publishedFormat,
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
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(mediaRows[0], "Media not found");
}
