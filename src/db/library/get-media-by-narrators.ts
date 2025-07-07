import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, desc, eq } from "drizzle-orm";
import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export type MediaByNarratorsType = Awaited<
  ReturnType<typeof getMediaByNarrators>
>;

type Narrator = {
  id: string;
  name: string;
};

export async function getMediaByNarrators(
  session: Session,
  narrators: Narrator[],
  mediaLimit: number,
) {
  if (narrators.length === 0) return [];

  const narratorIds = narrators.map((n) => n.id);
  const mediaForNarrators = await getMediaForNarrators(
    session,
    narratorIds,
    mediaLimit,
  );

  const bookIds = flatMapGroups(mediaForNarrators, (m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForNarrators, (m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return narrators.map((narrator) => ({
    ...narrator,
    media: (mediaForNarrators[narrator.id] ?? []).map((media) => ({
      ...media,
      book: {
        ...media.book,
        authors: authorsForBooks[media.book.id] ?? [],
      },
      narrators: narratorsForMedia[media.id] ?? [],
    })),
  }));
}

async function getMediaForNarrators(
  session: Session,
  narratorIds: string[],
  mediaLimit: number,
) {
  // NOTE: N+1 queries, but it's a small number of narrators (usually 1) and it's easier than doing window functions/CTEs.
  let map: Record<string, MediaForNarrator> = {};
  for (const narratorId of narratorIds) {
    map[narratorId] = await getMediaForNarrator(
      session,
      narratorId,
      mediaLimit,
    );
  }

  return map;
}

type MediaForNarrator = Awaited<ReturnType<typeof getMediaForNarrator>>;

async function getMediaForNarrator(
  session: Session,
  narratorId: string,
  limit: number,
) {
  return db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.mediaNarrators.url),
        eq(schema.media.id, schema.mediaNarrators.mediaId),
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
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.narratorId, narratorId),
      ),
    )
    .orderBy(desc(schema.media.published))
    .limit(limit);
}
