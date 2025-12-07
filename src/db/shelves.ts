import { Database } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, eq } from "drizzle-orm";

export async function addMediaToShelf(
  db: Database,
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(db, session, mediaId, shelfName);

  // This media is already on this shelf.
  if (existingRecord && !existingRecord.deletedAt) {
    return;
  }

  // This media was deleted from this shelf, so we need to add it back.
  if (existingRecord && existingRecord.deletedAt) {
    await reAddShelvedMedia(db, session, shelfName, mediaId);
    return;
  }

  // This media is not on this shelf, so we need to add it.
  await insertShelvedMedia(db, session, shelfName, mediaId);
  return;
}

export async function removeMediaFromShelf(
  db: Database,
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(db, session, mediaId, shelfName);

  // This media is not on this shelf.
  if (!existingRecord) {
    return;
  }

  // This media is already deleted from this shelf.
  if (existingRecord.deletedAt) {
    return;
  }

  // This media is on this shelf, so we need to delete it.
  await deleteShelvedMedia(db, session, shelfName, mediaId);
  return;
}

export async function toggleMediaOnShelf(
  db: Database,
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const existingRecord = await getShelvedMedia(db, session, mediaId, shelfName);

  // This media is not on this shelf.
  if (!existingRecord) {
    await addMediaToShelf(db, session, mediaId, shelfName);
    return;
  }

  // This media is already deleted from this shelf.
  if (existingRecord.deletedAt) {
    await reAddShelvedMedia(db, session, shelfName, mediaId);
    return;
  }

  // This media is on this shelf, so we need to delete it.
  await deleteShelvedMedia(db, session, shelfName, mediaId);
  return;
}

export type ShelvedMedia = Awaited<ReturnType<typeof getShelvedMedia>>;

export async function getShelvedMedia(
  db: Database,
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  return db.query.shelvedMedia.findFirst({
    where: and(
      eq(schema.shelvedMedia.url, session.url),
      eq(schema.shelvedMedia.userEmail, session.email),
      eq(schema.shelvedMedia.shelfName, shelfName),
      eq(schema.shelvedMedia.mediaId, mediaId),
    ),
  });
}

export async function isMediaOnShelf(
  db: Database,
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const rows = await db
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
  db: Database,
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return db
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
  db: Database,
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return db.insert(schema.shelvedMedia).values({
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
  db: Database,
  session: Session,
  shelfName: string,
  mediaId: string,
) {
  const now = new Date();

  return db
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
