import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, eq } from "drizzle-orm";

export type MediaIds = Awaited<ReturnType<typeof getMediaIds>>;

export async function getMediaIds(session: Session, mediaId: string) {
  const mediaRows = await db
    .select({
      id: schema.media.id,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);
  const media = requireValue(mediaRows[0], "Media not found");

  const bookAuthors = await db
    .select({ authorId: schema.bookAuthors.authorId })
    .from(schema.bookAuthors)
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, media.bookId),
      ),
    );

  const seriesBooks = await db
    .select({ seriesId: schema.seriesBooks.seriesId })
    .from(schema.seriesBooks)
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.bookId, media.bookId),
      ),
    );

  const mediaNarrators = await db
    .select({ narratorId: schema.mediaNarrators.narratorId })
    .from(schema.mediaNarrators)
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    );

  return {
    mediaId,
    bookId: media.bookId,
    authorIds: bookAuthors.map((ba) => ba.authorId),
    seriesIds: seriesBooks.map((sb) => sb.seriesId),
    narratorIds: mediaNarrators.map((mn) => mn.narratorId),
  };
}
