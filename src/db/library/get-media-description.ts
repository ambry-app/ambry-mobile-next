import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
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
  // 1. Fetch the media row
  const mediaRows = await db
    .select({
      description: schema.media.description,
      published: schema.media.published,
      publishedFormat: schema.media.publishedFormat,
      publisher: schema.media.publisher,
      notes: schema.media.notes,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  const media = requireValue(mediaRows[0], "Media not found");

  // 2. Fetch book info
  const bookRows = await db
    .select({
      published: schema.books.published,
      publishedFormat: schema.books.publishedFormat,
    })
    .from(schema.books)
    .where(
      and(eq(schema.books.url, session.url), eq(schema.books.id, media.bookId)),
    )
    .limit(1);

  const book = requireValue(bookRows[0], "Book not found");

  return {
    ...media,
    book,
  };
}
