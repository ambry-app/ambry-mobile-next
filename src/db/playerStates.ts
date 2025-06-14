import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import { useEffect, useState } from "react";
import { useMediaListByIds } from "./library";

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

export function useInProgressMedia(
  session: Session,
  withoutMediaId?: string | null,
) {
  const query = db
    .select({
      mediaId: sql<string>`COALESCE(local_player_states.media_id, player_states.media_id)`,
      playbackRate: sql<number>`COALESCE(local_player_states.playback_rate, player_states.playback_rate)`,
      position: sql<number>`COALESCE(local_player_states.position, player_states.position)`,
      status: sql<string>`COALESCE(local_player_states.status, player_states.status)`,
    })
    .from(schema.localPlayerStates)
    .fullJoin(
      schema.playerStates,
      eq(schema.localPlayerStates.mediaId, schema.playerStates.mediaId),
    )
    .where(
      or(
        and(
          eq(schema.localPlayerStates.url, session.url),
          eq(schema.localPlayerStates.userEmail, session.email),
          eq(schema.localPlayerStates.status, "in_progress"),
          withoutMediaId
            ? ne(schema.localPlayerStates.mediaId, withoutMediaId)
            : undefined,
        ),
        and(
          eq(schema.playerStates.url, session.url),
          eq(schema.playerStates.userEmail, session.email),
          eq(schema.playerStates.status, "in_progress"),
          withoutMediaId
            ? ne(schema.playerStates.mediaId, withoutMediaId)
            : undefined,
        ),
      ),
    )
    .orderBy(
      desc(
        sql`COALESCE(local_player_states.updated_at, player_states.updated_at)`,
      ),
    );

  const [playerStates, setPlayerStates] = useState<
    Awaited<ReturnType<(typeof query)["execute"]>>
  >([]);

  useEffect(() => {
    query.execute().then(setPlayerStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withoutMediaId]);

  const mediaIds = playerStates.map((state) => state.mediaId);
  const { media, ...rest } = useMediaListByIds(session, mediaIds);

  if (media.length === 0) return { media: [], ...rest };

  const mediaById = media.reduce(
    (acc, media) => {
      acc[media.id] = media;
      return acc;
    },
    {} as Record<string, (typeof media)[number]>,
  );

  const mediaWithPlayerStates = playerStates.flatMap((state) => {
    // NOTE: For some reason the query still returns states with status !=
    // in_progress even though we filter them out in the query. This is a dumb
    // workaround.
    if (state.mediaId in mediaById && state.status === "in_progress")
      return [{ playerState: state, ...mediaById[state.mediaId] }];
    return [];
  });

  return { media: mediaWithPlayerStates, ...rest };
}

export function useRecentInProgressMedia(
  session: Session,
  withoutMediaId: string | null,
) {
  const query = db
    .select({
      mediaId: schema.playerStates.mediaId,
      position: schema.playerStates.position,
      playbackRate: schema.playerStates.playbackRate,
      status: schema.playerStates.status,
    })
    .from(schema.playerStates)
    .innerJoin(schema.media, eq(schema.media.id, schema.playerStates.mediaId))
    .where(
      and(
        eq(schema.playerStates.url, session.url),
        eq(schema.playerStates.userEmail, session.email),
        eq(schema.playerStates.status, "in_progress"),
        lt(
          sql`CAST(${schema.playerStates.position} AS FLOAT) / CAST(${schema.media.duration} AS FLOAT)`,
          0.98,
        ),
        withoutMediaId
          ? ne(schema.playerStates.mediaId, withoutMediaId)
          : undefined,
      ),
    )
    .orderBy(desc(schema.playerStates.updatedAt))
    .limit(10);

  const [playerStates, setPlayerStates] = useState<
    Awaited<ReturnType<(typeof query)["execute"]>>
  >([]);

  useEffect(() => {
    query.execute().then(setPlayerStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withoutMediaId]);

  const mediaIds = playerStates.map((state) => state.mediaId);
  const { media, ...rest } = useMediaListByIds(session, mediaIds);

  if (media.length === 0) return { media: [], ...rest };

  const mediaWithPlayerStates = media.map((m, index) => ({
    ...m,
    playerState: playerStates[index],
  }));

  return { media: mediaWithPlayerStates, ...rest };
}
