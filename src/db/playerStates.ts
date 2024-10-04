import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq } from "drizzle-orm";

type Person = {
  id: string;
};

type Author = {
  id: string;
  name: string;
  person: Person;
};

type BookAuthor = {
  id: string;
  author: Author;
};

type Book = {
  id: string;
  title: string;
  bookAuthors: BookAuthor[];
};

type Media = {
  id: string;
  thumbnails: schema.Thumbnails | null;
  mpdPath: string | null;
  hlsPath: string | null;
  duration: string | null;
  book: Book;
};

interface PlayerState {
  url: string;
  insertedAt: Date;
  updatedAt: Date;
  mediaId: string;
  status: "not_started" | "in_progress" | "finished";
  userEmail: string;
  playbackRate: number;
  position: number;
  media: Media;
}

export interface SyncedPlayerState extends PlayerState {}
export interface LocalPlayerState extends PlayerState {}

export async function getSyncedPlayerState(
  session: Session,
  mediaId: string,
): Promise<SyncedPlayerState | undefined> {
  return db.query.playerStates.findFirst({
    where: and(
      eq(schema.playerStates.url, session.url),
      eq(schema.playerStates.userEmail, session.email),
      eq(schema.playerStates.mediaId, mediaId),
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
        },
        with: {
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

export async function getLocalPlayerState(
  session: Session,
  mediaId: string,
): Promise<LocalPlayerState | undefined> {
  return db.query.localPlayerStates.findFirst({
    where: and(
      eq(schema.localPlayerStates.url, session.url),
      eq(schema.localPlayerStates.userEmail, session.email),
      eq(schema.localPlayerStates.mediaId, mediaId),
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
        },
        with: {
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
): Promise<LocalPlayerState> {
  return createPlayerState(session, mediaId, 1, 0, "in_progress");
}

export async function createPlayerState(
  session: Session,
  mediaId: string,
  playbackRate: number,
  position: number,
  status: PlayerState["status"],
): Promise<LocalPlayerState> {
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
    status?: PlayerState["status"];
  },
): Promise<LocalPlayerState> {
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
