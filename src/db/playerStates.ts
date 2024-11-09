import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq } from "drizzle-orm";

export async function getSyncedPlayerState(session: Session, mediaId: string) {
  return db.query.playerStates.findFirst({
    where: and(
      eq(schema.playerStates.url, session.url),
      eq(schema.playerStates.mediaId, mediaId),
      eq(schema.playerStates.userEmail, session.email),
    ),
    orderBy: desc(schema.playerStates.updatedAt),
    with: {
      media: {
        columns: {
          id: true,
          thumbnails: true,
          mpdPath: true,
          hlsPath: true,
          duration: true,
          chapters: true,
        },
        with: {
          download: {
            columns: { status: true, filePath: true, thumbnails: true },
          },
          book: {
            columns: { id: true, title: true },
            with: {
              bookAuthors: {
                columns: { id: true },
                with: {
                  author: {
                    columns: { id: true, name: true },
                    with: { person: { columns: { id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export type LocalPlayerState = Exclude<
  Awaited<ReturnType<typeof getLocalPlayerState>>,
  undefined
>;

export async function getLocalPlayerState(session: Session, mediaId: string) {
  return db.query.localPlayerStates.findFirst({
    where: and(
      eq(schema.localPlayerStates.url, session.url),
      eq(schema.localPlayerStates.mediaId, mediaId),
      eq(schema.localPlayerStates.userEmail, session.email),
    ),
    orderBy: desc(schema.localPlayerStates.updatedAt),
    with: {
      media: {
        columns: {
          id: true,
          thumbnails: true,
          mpdPath: true,
          hlsPath: true,
          duration: true,
          chapters: true,
        },
        with: {
          download: {
            columns: { status: true, filePath: true, thumbnails: true },
          },
          book: {
            columns: { id: true, title: true },
            with: {
              bookAuthors: {
                columns: { id: true },
                with: {
                  author: {
                    columns: { id: true, name: true },
                    with: { person: { columns: { id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createInitialPlayerState(
  session: Session,
  mediaId: string,
) {
  return createPlayerState(session, mediaId, 1, 0, "in_progress");
}

export async function createPlayerState(
  session: Session,
  mediaId: string,
  playbackRate: number,
  position: number,
  status: schema.LocalPlayerStateInsert["status"],
) {
  const now = new Date();

  await db.insert(schema.localPlayerStates).values({
    url: session.url,
    mediaId: mediaId,
    userEmail: session.email,
    playbackRate,
    position,
    status,
    insertedAt: now,
    updatedAt: now,
  });

  return (await getLocalPlayerState(session, mediaId))!;
}

export async function updatePlayerState(
  session: Session,
  mediaId: string,
  attributes: {
    playbackRate?: number;
    position?: number;
    status?: schema.LocalPlayerStateInsert["status"];
  },
) {
  const now = new Date();

  await db
    .update(schema.localPlayerStates)
    .set({
      ...attributes,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.localPlayerStates.url, session.url),
        eq(schema.localPlayerStates.userEmail, session.email),
        eq(schema.localPlayerStates.mediaId, mediaId),
      ),
    );

  return (await getLocalPlayerState(session, mediaId))!;
}

export async function getMostRecentInProgressSyncedMedia(
  session: Session,
): Promise<{ updatedAt: Date; mediaId: string } | undefined> {
  return db.query.playerStates.findFirst({
    columns: { mediaId: true, updatedAt: true },
    where: and(
      eq(schema.playerStates.url, session.url),
      eq(schema.playerStates.userEmail, session.email),
      eq(schema.playerStates.status, "in_progress"),
    ),
    orderBy: desc(schema.playerStates.updatedAt),
  });
}

export async function getMostRecentInProgressLocalMedia(
  session: Session,
): Promise<{ updatedAt: Date; mediaId: string } | undefined> {
  return db.query.localPlayerStates.findFirst({
    columns: { mediaId: true, updatedAt: true },
    where: and(
      eq(schema.localPlayerStates.url, session.url),
      eq(schema.localPlayerStates.userEmail, session.email),
      eq(schema.localPlayerStates.status, "in_progress"),
    ),
    orderBy: desc(schema.localPlayerStates.updatedAt),
  });
}
