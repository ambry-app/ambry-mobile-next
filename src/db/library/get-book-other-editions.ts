import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { MediaHeaderInfo } from "./get-media-header-info";

export type BookOtherEditions = Awaited<
  ReturnType<typeof getBookOtherEditions>
>;

export async function getBookOtherEditions(
  session: Session,
  media: MediaHeaderInfo,
) {
  const { book } = media;
  const otherMedia = await getOtherMedia(session, book.id, media.id);

  if (otherMedia.length === 0) return null;

  const mediaIds = otherMedia.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const narratorsByMediaId = Object.groupBy(
    narrators,
    (narrator) => narrator.mediaId,
  );

  return {
    ...book,
    media: otherMedia.map((media) => ({
      ...media,
      narrators: (narratorsByMediaId[media.id] ?? []).map(
        ({ mediaId, ...narrator }) => narrator,
      ),
    })),
  };
}

async function getOtherMedia(
  session: Session,
  bookId: string,
  withoutMediaId: string,
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
    .limit(10);
}

async function getNarratorsForMedia(session: Session, mediaIds: string[]) {
  return db
    .select({
      name: schema.narrators.name,
      mediaId: schema.mediaNarrators.mediaId,
    })
    .from(schema.narrators)
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.narrators.url),
        eq(schema.mediaNarrators.narratorId, schema.narrators.id),
      ),
    )
    .where(
      and(
        eq(schema.narrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}
