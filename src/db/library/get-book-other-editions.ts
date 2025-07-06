import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq, ne } from "drizzle-orm";
import { MediaHeaderInfo } from "./get-media-header-info";
import { getNarratorsForMedia } from "./shared-queries";

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

  return {
    ...book,
    media: otherMedia.map((media) => ({
      ...media,
      narrators: narratorsForMedia[media.id] ?? [],
    })),
  };
}

async function getOtherMedia(
  session: Session,
  bookId: string,
  withoutMediaId: string,
  limit: number,
) {
  return db
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
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.bookId, bookId),
        ne(schema.media.id, withoutMediaId),
      ),
    )
    .orderBy(desc(schema.media.published))
    .limit(limit);
}
