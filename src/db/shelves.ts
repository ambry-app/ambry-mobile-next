import { and, desc, eq, isNull, lt } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";

import {
  getAuthorsForBooks,
  getNarratorsForMedia,
} from "./library/shared-queries";

export async function addMediaToShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(session, mediaId, shelfName);

  // This media is already on this shelf.
  if (existingRecord && !existingRecord.deletedAt) {
    return;
  }

  // This media was deleted from this shelf, so we need to add it back.
  if (existingRecord && existingRecord.deletedAt) {
    await reAddShelvedMedia(session, shelfName, mediaId);
    return;
  }

  // This media is not on this shelf, so we need to add it.
  await insertShelvedMedia(session, shelfName, mediaId);
  return;
}

export async function removeMediaFromShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(session, mediaId, shelfName);

  // This media is not on this shelf.
  if (!existingRecord) {
    return;
  }

  // This media is already deleted from this shelf.
  if (existingRecord.deletedAt) {
    return;
  }

  // This media is on this shelf, so we need to delete it.
  await deleteShelvedMedia(session, shelfName, mediaId);
  return;
}

export async function toggleMediaOnShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(session, mediaId, shelfName);

  // This media is not on this shelf.
  if (!existingRecord) {
    await addMediaToShelf(session, mediaId, shelfName);
    return;
  }

  // This media is already deleted from this shelf.
  if (existingRecord.deletedAt) {
    await reAddShelvedMedia(session, shelfName, mediaId);
    return;
  }

  // This media is on this shelf, so we need to delete it.
  await deleteShelvedMedia(session, shelfName, mediaId);
  return;
}

export type ShelvedMedia = Awaited<ReturnType<typeof getShelvedMedia>>;

export async function getShelvedMedia(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  return getDb().query.shelvedMedia.findFirst({
    where: and(
      eq(schema.shelvedMedia.url, session.url),
      eq(schema.shelvedMedia.userEmail, session.email),
      eq(schema.shelvedMedia.shelfName, shelfName),
      eq(schema.shelvedMedia.mediaId, mediaId),
    ),
  });
}

export async function isMediaOnShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const rows = await getDb()
    .select({ deletedAt: schema.shelvedMedia.deletedAt })
    .from(schema.shelvedMedia)
    .where(
      and(
        eq(schema.shelvedMedia.url, session.url),
        eq(schema.shelvedMedia.userEmail, session.email),
        eq(schema.shelvedMedia.shelfName, shelfName),
        eq(schema.shelvedMedia.mediaId, mediaId),
      ),
    );

  return rows[0] ? !rows[0].deletedAt : false;
}

async function reAddShelvedMedia(
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return getDb()
    .update(schema.shelvedMedia)
    .set({
      deletedAt: null,
      addedAt: now,
      synced: false,
    })
    .where(
      and(
        eq(schema.shelvedMedia.url, session.url),
        eq(schema.shelvedMedia.userEmail, session.email),
        eq(schema.shelvedMedia.shelfName, shelfName),
        eq(schema.shelvedMedia.mediaId, mediaId),
      ),
    );
}

async function insertShelvedMedia(
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return getDb().insert(schema.shelvedMedia).values({
    url: session.url,
    userEmail: session.email,
    shelfName,
    mediaId,
    addedAt: now,
    deletedAt: null,
    priority: 0,
    synced: false,
  });
}

async function deleteShelvedMedia(
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return getDb()
    .update(schema.shelvedMedia)
    .set({
      deletedAt: now,
      synced: false,
    })
    .where(
      and(
        eq(schema.shelvedMedia.url, session.url),
        eq(schema.shelvedMedia.userEmail, session.email),
        eq(schema.shelvedMedia.shelfName, shelfName),
        eq(schema.shelvedMedia.mediaId, mediaId),
      ),
    );
}

// =============================================================================
// Query Functions for UI
// =============================================================================

export async function getSavedMediaPage(
  session: Session,
  limit: number,
  addedBefore?: Date,
) {
  const savedMedia = await getSavedMediaRaw(session, limit, addedBefore);

  const mediaIds = savedMedia.map((s) => s.media.id);
  const bookIds = savedMedia.map((s) => s.media.book.id);

  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return savedMedia.map((s) => ({
    ...s,
    media: {
      ...s.media,
      book: {
        ...s.media.book,
        authors: authorsForBooks[s.media.book.id] || [],
      },
      narrators: narratorsForMedia[s.media.id] || [],
    },
  }));
}

async function getSavedMediaRaw(
  session: Session,
  limit: number,
  addedBefore?: Date,
) {
  const rows = await getDb()
    .select({
      addedAt: schema.shelvedMedia.addedAt,
      media: {
        id: schema.media.id,
        thumbnails: schema.media.thumbnails,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.shelvedMedia)
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.shelvedMedia.url),
        eq(schema.media.id, schema.shelvedMedia.mediaId),
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
        eq(schema.shelvedMedia.url, session.url),
        eq(schema.shelvedMedia.userEmail, session.email),
        eq(schema.shelvedMedia.shelfName, "saved"),
        isNull(schema.shelvedMedia.deletedAt),
        addedBefore ? lt(schema.shelvedMedia.addedAt, addedBefore) : undefined,
      ),
    )
    .orderBy(desc(schema.shelvedMedia.addedAt))
    .limit(limit);

  return rows.map(({ book, download, ...row }) => ({
    ...row,
    media: {
      ...row.media,
      book,
      download,
    },
  }));
}

export type SavedMediaWithDetails = Awaited<
  ReturnType<typeof getSavedMediaPage>
>[number];
