import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export type Media = Awaited<ReturnType<typeof getMedia>>;

export async function getMedia(session: Session, mediaId: string) {
  const media = await getMediaById(session, mediaId);
  const authorsForBooks = await getAuthorsForBooks(session, [media.book.id]);
  const narratorsForMedia = await getNarratorsForMedia(session, [media.id]);

  return {
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] || [],
    },
    narrators: narratorsForMedia[media.id] || [],
  };
}

async function getMediaById(session: Session, mediaId: string) {
  const rows = await getDb()
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
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
    );

  return requireValue(rows[0], `Media with ID ${mediaId} not found`);
}
