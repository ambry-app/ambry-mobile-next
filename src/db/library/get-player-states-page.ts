import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import { getAuthorsForBooks, getNarratorsForMedia } from "./shared-queries";

export async function getPlayerStatesPage(
  session: Session,
  limit: number,
  state: "in_progress" | "finished",
  withoutMediaId?: string | null,
  updatedBefore?: Date,
) {
  const playerStates = await getPlayerStates(
    session,
    limit,
    state,
    withoutMediaId,
    updatedBefore,
  );

  const mediaIds = playerStates.map((ps) => ps.media.id);
  const bookIds = playerStates.map((ps) => ps.media.book.id);

  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return playerStates.map((ps) => ({
    ...ps,
    media: {
      ...ps.media,
      book: {
        ...ps.media.book,
        authors: authorsForBooks[ps.media.book.id] || [],
      },
      narrators: narratorsForMedia[ps.media.id] || [],
    },
  }));
}

async function getPlayerStates(
  session: Session,
  limit: number,
  state: "in_progress" | "finished",
  withoutMediaId?: string | null,
  updatedBefore?: Date,
) {
  const playerStates = await db
    .select({
      playbackRate: sql<number>`COALESCE(local_player_states.playback_rate, player_states.playback_rate)`,
      position: sql<number>`COALESCE(local_player_states.position, player_states.position)`,
      updatedAt: sql<Date>`COALESCE(local_player_states.updated_at, player_states.updated_at)`,
      media: {
        id: schema.media.id,
        thumbnails: schema.media.thumbnails,
        duration: schema.media.duration,
      },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.localPlayerStates)
    .fullJoin(
      schema.playerStates,
      and(
        eq(schema.playerStates.url, schema.localPlayerStates.url),
        eq(schema.playerStates.mediaId, schema.localPlayerStates.mediaId),
      ),
    )
    .innerJoin(
      schema.media,
      and(
        eq(
          schema.media.url,
          sql`COALESCE(local_player_states.url, player_states.url)`,
        ),
        eq(
          schema.media.id,
          sql`COALESCE(local_player_states.media_id, player_states.media_id)`,
        ),
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
        eq(
          sql`COALESCE(local_player_states.url, player_states.url)`,
          session.url,
        ),
        eq(
          sql`COALESCE(local_player_states.user_email, player_states.user_email)`,
          session.email,
        ),
        eq(
          sql`COALESCE(local_player_states.status, player_states.status)`,
          state,
        ),
        withoutMediaId
          ? ne(
              sql`COALESCE(local_player_states.media_id, player_states.media_id)`,
              withoutMediaId,
            )
          : undefined,
        updatedBefore
          ? lt(
              sql`COALESCE(local_player_states.updated_at, player_states.updated_at)`,
              updatedBefore,
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(
        sql`COALESCE(local_player_states.updated_at, player_states.updated_at)`,
      ),
    )
    .limit(limit);

  return playerStates.map(({ book, download, ...ps }) => ({
    ...ps,
    media: {
      ...ps.media,
      book,
      download,
    },
  }));
}
