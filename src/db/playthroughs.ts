import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { randomUUID } from "@/src/utils/crypto";

// =============================================================================
// Playthrough CRUD
// =============================================================================

export async function getActivePlaythrough(session: Session, mediaId: string) {
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      eq(schema.playthroughs.mediaId, mediaId),
      eq(schema.playthroughs.status, "in_progress"),
      isNull(schema.playthroughs.deletedAt),
    ),
    with: {
      stateCache: true,
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

export type ActivePlaythrough = Exclude<
  Awaited<ReturnType<typeof getActivePlaythrough>>,
  undefined
>;

export async function getPlaythroughById(
  session: Session,
  playthroughId: string,
) {
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.id, playthroughId),
    ),
    with: {
      stateCache: true,
    },
  });
}

export async function getFinishedOrAbandonedPlaythrough(
  session: Session,
  mediaId: string,
) {
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      eq(schema.playthroughs.mediaId, mediaId),
      isNull(schema.playthroughs.deletedAt),
      sql`${schema.playthroughs.status} IN ('finished', 'abandoned')`,
    ),
    orderBy: desc(schema.playthroughs.updatedAt),
    with: {
      stateCache: true,
    },
  });
}

export async function createPlaythrough(
  session: Session,
  mediaId: string,
): Promise<string> {
  const now = new Date();
  const id = randomUUID();

  await getDb().insert(schema.playthroughs).values({
    id,
    url: session.url,
    userEmail: session.email,
    mediaId,
    status: "in_progress",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    // syncedAt is null - pending sync
  });

  return id;
}

export async function updatePlaythroughStatus(
  session: Session,
  playthroughId: string,
  status: schema.PlaythroughStatus,
  timestamps: {
    finishedAt?: Date | null;
    abandonedAt?: Date | null;
  } = {},
) {
  const now = new Date();

  await getDb()
    .update(schema.playthroughs)
    .set({
      status,
      ...timestamps,
      updatedAt: now,
      syncedAt: null, // Mark for sync
    })
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.id, playthroughId),
      ),
    );
}

export async function resumePlaythrough(
  session: Session,
  playthroughId: string,
) {
  const now = new Date();

  await getDb()
    .update(schema.playthroughs)
    .set({
      status: "in_progress",
      finishedAt: null,
      abandonedAt: null,
      updatedAt: now,
      syncedAt: null,
    })
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.id, playthroughId),
      ),
    );
}

export async function deletePlaythrough(
  session: Session,
  playthroughId: string,
) {
  const now = new Date();

  await getDb()
    .update(schema.playthroughs)
    .set({
      deletedAt: now,
      updatedAt: now,
      syncedAt: null,
    })
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.id, playthroughId),
      ),
    );
}

// =============================================================================
// State Derivation
// =============================================================================

export interface DerivedPlaythroughState {
  currentPosition: number;
  currentRate: number;
  lastEventAt: Date;
}

/**
 * Get derived state from cache (fast path).
 * Falls back to computing from events if cache miss.
 */
export async function getDerivedState(
  playthroughId: string,
): Promise<DerivedPlaythroughState | null> {
  // Try cache first
  const cache = await getDb().query.playthroughStateCache.findFirst({
    where: eq(schema.playthroughStateCache.playthroughId, playthroughId),
  });

  if (cache) {
    return {
      currentPosition: cache.currentPosition,
      currentRate: cache.currentRate,
      lastEventAt: cache.lastEventAt,
    };
  }

  // Cache miss - compute from events
  return computeStateFromEvents(playthroughId);
}

/**
 * Compute state directly from events (slow path, used for cache rebuild).
 */
export async function computeStateFromEvents(
  playthroughId: string,
): Promise<DerivedPlaythroughState | null> {
  // Get most recent playback event (not lifecycle events)
  const lastEvent = await getDb().query.playbackEvents.findFirst({
    where: and(
      eq(schema.playbackEvents.playthroughId, playthroughId),
      sql`${schema.playbackEvents.type} IN ('play', 'pause', 'seek', 'rate_change')`,
    ),
    orderBy: desc(schema.playbackEvents.timestamp),
  });

  if (
    !lastEvent ||
    lastEvent.position == null ||
    lastEvent.playbackRate == null
  ) {
    return null;
  }

  const state = {
    currentPosition: lastEvent.position,
    currentRate: lastEvent.playbackRate,
    lastEventAt: lastEvent.timestamp,
  };

  // Update cache for next time
  await updateStateCache(
    playthroughId,
    state.currentPosition,
    state.currentRate,
    state.lastEventAt,
  );

  return state;
}

/**
 * Update the state cache for a playthrough.
 */
export async function updateStateCache(
  playthroughId: string,
  position: number,
  rate: number,
  eventAt?: Date,
) {
  const now = new Date();
  const lastEventAt = eventAt ?? now;

  await getDb()
    .insert(schema.playthroughStateCache)
    .values({
      playthroughId,
      currentPosition: position,
      currentRate: rate,
      lastEventAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.playthroughStateCache.playthroughId,
      set: {
        currentPosition: position,
        currentRate: rate,
        lastEventAt,
        updatedAt: now,
      },
    });
}

// =============================================================================
// Query Functions for UI
// =============================================================================

export async function getMostRecentInProgressPlaythrough(session: Session) {
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      eq(schema.playthroughs.status, "in_progress"),
      isNull(schema.playthroughs.deletedAt),
    ),
    orderBy: desc(schema.playthroughs.updatedAt),
    with: {
      stateCache: true,
    },
  });
}

// =============================================================================
// Sync Helpers
// =============================================================================

export async function getUnsyncedPlaythroughs(session: Session) {
  return getDb().query.playthroughs.findMany({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      isNull(schema.playthroughs.syncedAt),
    ),
  });
}

export async function getUnsyncedEvents(playthroughIds: string[]) {
  if (playthroughIds.length === 0) return [];

  return getDb().query.playbackEvents.findMany({
    where: and(
      inArray(schema.playbackEvents.playthroughId, playthroughIds),
      isNull(schema.playbackEvents.syncedAt),
    ),
    orderBy: schema.playbackEvents.timestamp,
  });
}

export async function markPlaythroughsSynced(
  playthroughIds: string[],
  syncedAt: Date,
) {
  if (playthroughIds.length === 0) return;

  await getDb()
    .update(schema.playthroughs)
    .set({ syncedAt })
    .where(inArray(schema.playthroughs.id, playthroughIds));
}

export async function markEventsSynced(eventIds: string[], syncedAt: Date) {
  if (eventIds.length === 0) return;

  await getDb()
    .update(schema.playbackEvents)
    .set({ syncedAt })
    .where(inArray(schema.playbackEvents.id, eventIds));
}

// =============================================================================
// Upsert functions for down-sync
// =============================================================================

export async function upsertPlaythrough(playthrough: schema.PlaythroughInsert) {
  await getDb()
    .insert(schema.playthroughs)
    .values(playthrough)
    .onConflictDoUpdate({
      target: [schema.playthroughs.url, schema.playthroughs.id],
      set: {
        status: playthrough.status,
        startedAt: playthrough.startedAt,
        finishedAt: playthrough.finishedAt,
        abandonedAt: playthrough.abandonedAt,
        deletedAt: playthrough.deletedAt,
        updatedAt: playthrough.updatedAt,
        syncedAt: playthrough.syncedAt,
      },
    });
}

export async function upsertPlaybackEvent(event: schema.PlaybackEventInsert) {
  // Events are immutable - on conflict we only update syncedAt if provided
  if (event.syncedAt !== undefined) {
    await getDb()
      .insert(schema.playbackEvents)
      .values(event)
      .onConflictDoUpdate({
        target: schema.playbackEvents.id,
        set: {
          syncedAt: event.syncedAt,
        },
      });
  } else {
    await getDb()
      .insert(schema.playbackEvents)
      .values(event)
      .onConflictDoNothing();
  }
}
