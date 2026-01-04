import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { Database, getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { randomUUID } from "@/utils/crypto";

// =============================================================================
// Playthrough CRUD
// =============================================================================

export async function getInProgressPlaythrough(
  session: Session,
  mediaId: string,
) {
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      eq(schema.playthroughs.mediaId, mediaId),
      eq(schema.playthroughs.status, "in_progress"),
      isNull(schema.playthroughs.deletedAt),
    ),
    // Note: updatedAt is used here for edge-case duplicate handling during migration,
    // not for user-facing ordering. There should only ever be one in_progress playthrough
    // per media, so this ordering rarely matters in practice.
    orderBy: desc(schema.playthroughs.updatedAt),
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
  Awaited<ReturnType<typeof getInProgressPlaythrough>>,
  undefined
>;

export async function getPlaythroughWithMedia(
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

export async function getPlaythrough(session: Session, playthroughId: string) {
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
  // Order by the relevant completion timestamp (finishedAt or abandonedAt)
  // not updatedAt (which is sync metadata)
  return getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.userEmail, session.email),
      eq(schema.playthroughs.mediaId, mediaId),
      isNull(schema.playthroughs.deletedAt),
      sql`${schema.playthroughs.status} IN ('finished', 'abandoned')`,
    ),
    orderBy: desc(
      sql`COALESCE(${schema.playthroughs.finishedAt}, ${schema.playthroughs.abandonedAt})`,
    ),
    with: {
      stateCache: true,
      media: {
        columns: {
          duration: true,
        },
      },
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
 * Only updates if the event is newer than the current cached state.
 *
 * @param db - Optional database/transaction context. Defaults to getDb().
 *             Pass a transaction context when calling within a transaction.
 */
export async function updateStateCache(
  playthroughId: string,
  position: number,
  rate: number,
  eventAt?: Date,
  db: Database = getDb(),
) {
  const now = new Date();
  const lastEventAt = eventAt ?? now;

  // Check if there's an existing cache entry with a newer timestamp
  const existing = await db.query.playthroughStateCache.findFirst({
    where: eq(schema.playthroughStateCache.playthroughId, playthroughId),
  });

  // Only update if no existing entry, or if this event is newer
  if (existing && existing.lastEventAt >= lastEventAt) {
    return; // Skip - existing cache is more recent
  }

  await db
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

export async function getAllPlaythroughsForMedia(
  session: Session,
  mediaId: string,
) {
  // Order by lastEventAt from state cache (most recent activity first)
  // not updatedAt (which is sync metadata)
  // Using JOIN pattern consistent with other library queries
  const results = await getDb()
    .select({
      id: schema.playthroughs.id,
      mediaId: schema.playthroughs.mediaId,
      status: schema.playthroughs.status,
      startedAt: schema.playthroughs.startedAt,
      finishedAt: schema.playthroughs.finishedAt,
      abandonedAt: schema.playthroughs.abandonedAt,
      updatedAt: schema.playthroughs.updatedAt,
      stateCache: {
        currentPosition: schema.playthroughStateCache.currentPosition,
        currentRate: schema.playthroughStateCache.currentRate,
        lastEventAt: schema.playthroughStateCache.lastEventAt,
      },
    })
    .from(schema.playthroughs)
    .leftJoin(
      schema.playthroughStateCache,
      eq(schema.playthroughStateCache.playthroughId, schema.playthroughs.id),
    )
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.userEmail, session.email),
        eq(schema.playthroughs.mediaId, mediaId),
        isNull(schema.playthroughs.deletedAt),
      ),
    )
    .orderBy(desc(schema.playthroughStateCache.lastEventAt));

  return results;
}

export type PlaythroughForMedia = Awaited<
  ReturnType<typeof getAllPlaythroughsForMedia>
>[number];

// =============================================================================
// Debug
// =============================================================================

export async function getPlaythroughForDebug(playthroughId: string) {
  const playthrough = await getDb().query.playthroughs.findFirst({
    where: eq(schema.playthroughs.id, playthroughId),
    with: {
      stateCache: true,
    },
  });

  if (!playthrough) return null;

  const events = await getDb().query.playbackEvents.findMany({
    where: eq(schema.playbackEvents.playthroughId, playthroughId),
    orderBy: desc(schema.playbackEvents.timestamp),
  });

  return { playthrough, events };
}

export type PlaythroughDebugData = NonNullable<
  Awaited<ReturnType<typeof getPlaythroughForDebug>>
>;

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

// =============================================================================
// Active Playthrough (Device-Specific)
// =============================================================================

/**
 * Get the active playthrough ID stored for this device.
 * This is used on app boot to determine which playthrough to load into the player.
 */
export async function getActivePlaythroughIdForDevice(
  session: Session,
): Promise<string | null> {
  const profile = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
    columns: {
      activePlaythroughId: true,
    },
  });

  return profile?.activePlaythroughId ?? null;
}

/**
 * Set the active playthrough ID for this device.
 * Called when loading a playthrough into the player.
 */
export async function setActivePlaythroughIdForDevice(
  session: Session,
  playthroughId: string,
): Promise<void> {
  await getDb()
    .insert(schema.serverProfiles)
    .values({
      url: session.url,
      userEmail: session.email,
      activePlaythroughId: playthroughId,
    })
    .onConflictDoUpdate({
      target: [schema.serverProfiles.url, schema.serverProfiles.userEmail],
      set: {
        activePlaythroughId: playthroughId,
      },
    });
}

/**
 * Clear the active playthrough ID for this device.
 * Called when finishing, abandoning, or explicitly unloading the player.
 */
export async function clearActivePlaythroughIdForDevice(
  session: Session,
): Promise<void> {
  await getDb()
    .update(schema.serverProfiles)
    .set({
      activePlaythroughId: null,
    })
    .where(
      and(
        eq(schema.serverProfiles.url, session.url),
        eq(schema.serverProfiles.userEmail, session.email),
      ),
    );
}
