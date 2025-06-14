import { Session } from "@/src/stores/session";
import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import useFadeInQuery from "@/src/hooks/use.fade.in.query";

export async function addMediaToShelf(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  // const now = new Date();

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

async function getShelvedMedia(
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

async function reAddShelvedMedia(
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

export function useShelvedMedia(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const query = db.query.shelvedMedia.findFirst({
    where: and(
      eq(schema.shelvedMedia.url, session.url),
      eq(schema.shelvedMedia.userEmail, session.email),
      eq(schema.shelvedMedia.shelfName, shelfName),
      eq(schema.shelvedMedia.mediaId, mediaId),
    ),
  });

  const { data, ...rest } = useFadeInQuery(query);
  const isSaved = data && !data.deletedAt;
  return { isSaved: isSaved, ...rest };
}
