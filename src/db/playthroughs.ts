import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { Database, getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { PlaybackEventInsert } from "@/db/schema";
import { Session } from "@/types/session";
import { randomUUID } from "@/utils/crypto";
import { logBase } from "@/utils/logger";

const log = logBase.extend("playthroughs");

// =============================================================================
// Playthrough Queries
// =============================================================================

export type InProgressPlaythroughWithMedia = NonNullable<
  Awaited<ReturnType<typeof getInProgressPlaythroughWithMedia>>
>;

export async function getInProgressPlaythroughWithMedia(
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
    // Order by lastEventAt (most recent activity first)
    orderBy: desc(schema.playthroughs.lastEventAt),
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

export type PlaythroughWithMedia = Awaited<
  ReturnType<typeof getPlaythroughWithMedia>
>;

export async function getPlaythroughWithMedia(
  session: Session,
  playthroughId: string,
) {
  const playthrough = await getDb().query.playthroughs.findFirst({
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

  if (!playthrough) {
    throw new Error(`Playthrough not found: ${playthroughId}`);
  }

  return playthrough;
}

export type Playthrough = Awaited<ReturnType<typeof getPlaythrough>>;

export async function getPlaythrough(session: Session, playthroughId: string) {
  const playthrough = await getDb().query.playthroughs.findFirst({
    where: and(
      eq(schema.playthroughs.url, session.url),
      eq(schema.playthroughs.id, playthroughId),
    ),
  });

  if (!playthrough) {
    throw new Error(`Playthrough not found: ${playthroughId}`);
  }

  return playthrough;
}

export type FinishedOrAbandonedPlaythrough = NonNullable<
  Awaited<ReturnType<typeof getFinishedOrAbandonedPlaythrough>>
>;

export async function getFinishedOrAbandonedPlaythrough(
  session: Session,
  mediaId: string,
) {
  // Order by the relevant completion timestamp (finishedAt or abandonedAt)
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

export type PlaythroughForMedia = Awaited<
  ReturnType<typeof getAllPlaythroughsForMedia>
>[number];

export async function getAllPlaythroughsForMedia(
  session: Session,
  mediaId: string,
) {
  // Query playthroughs directly - position/rate/lastEventAt are now on the playthrough
  // Left join state cache for crash recovery position
  const results = await getDb()
    .select({
      id: schema.playthroughs.id,
      mediaId: schema.playthroughs.mediaId,
      status: schema.playthroughs.status,
      startedAt: schema.playthroughs.startedAt,
      finishedAt: schema.playthroughs.finishedAt,
      abandonedAt: schema.playthroughs.abandonedAt,
      position: schema.playthroughs.position,
      playbackRate: schema.playthroughs.playbackRate,
      lastEventAt: schema.playthroughs.lastEventAt,
      stateCache: {
        position: schema.playthroughStateCache.position,
        updatedAt: schema.playthroughStateCache.updatedAt,
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
    .orderBy(desc(schema.playthroughs.lastEventAt));

  return results;
}

// =============================================================================
// Event Recording
// =============================================================================

/**
 * Insert a playback event into the database.
 * Events are the source of truth - playthroughs are derived from events.
 *
 * @param event - The event data to insert
 * @param db - Optional database/transaction context
 */
export async function insertEvent(
  event: PlaybackEventInsert,
  db: Database = getDb(),
): Promise<void> {
  await db.insert(schema.playbackEvents).values(event);
}

/**
 * Record a start event for a new playthrough.
 * Returns the generated playthrough ID.
 */
export function createStartEvent(
  mediaId: string,
  deviceId: string,
  playbackRate: number = 1.0,
): { playthroughId: string; event: PlaybackEventInsert } {
  const playthroughId = randomUUID();
  const now = new Date();

  const event: PlaybackEventInsert = {
    id: randomUUID(),
    playthroughId,
    deviceId,
    mediaId, // Required for start events
    type: "start",
    timestamp: now,
    position: 0,
    playbackRate,
    syncedAt: null, // Mark for sync
  };

  return { playthroughId, event };
}

/**
 * Create a playback event (play, pause, seek, rate_change).
 */
export function createPlaybackEvent(
  playthroughId: string,
  deviceId: string,
  type: "play" | "pause" | "seek" | "rate_change",
  position: number,
  playbackRate: number,
  extras?: {
    fromPosition?: number;
    toPosition?: number;
    previousRate?: number;
  },
): PlaybackEventInsert {
  return {
    id: randomUUID(),
    playthroughId,
    deviceId,
    type,
    timestamp: new Date(),
    position,
    playbackRate,
    fromPosition: extras?.fromPosition,
    toPosition: extras?.toPosition,
    previousRate: extras?.previousRate,
    syncedAt: null, // Mark for sync
  };
}

/**
 * Create a lifecycle event (finish, abandon, resume, delete).
 */
export function createLifecycleEvent(
  playthroughId: string,
  deviceId: string,
  type: "finish" | "abandon" | "resume" | "delete",
): PlaybackEventInsert {
  return {
    id: randomUUID(),
    playthroughId,
    deviceId,
    type,
    timestamp: new Date(),
    syncedAt: null, // Mark for sync
  };
}

// =============================================================================
// State Cache (Crash Recovery Only)
// =============================================================================

/**
 * Update the state cache for a playthrough.
 * This is used by the heartbeat service for crash recovery.
 *
 * The cache only stores position - rate and lastEventAt live on the playthrough.
 * Only updates if the new timestamp is more recent than the existing cache.
 *
 * @param playthroughId - The playthrough to update
 * @param position - Current playback position
 * @param db - Optional database/transaction context
 */
export async function updateStateCache(
  playthroughId: string,
  position: number,
  db: Database = getDb(),
): Promise<void> {
  const now = new Date();

  await db
    .insert(schema.playthroughStateCache)
    .values({
      playthroughId,
      position,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.playthroughStateCache.playthroughId,
      set: {
        position,
        updatedAt: now,
      },
    });

  log.debug(`Updated state cache for ${playthroughId}: position=${position}`);
}

/**
 * Get the effective position for a playthrough.
 * Returns the more recent of: state cache position or playthrough position.
 *
 * The state cache is updated by the heartbeat service every 30s during playback.
 * The playthrough position is updated when events are replayed.
 * We use whichever was updated more recently.
 */
export function getEffectivePosition(playthrough: {
  position: number;
  lastEventAt: Date;
  stateCache: { position: number; updatedAt: Date } | null;
}): number {
  if (!playthrough.stateCache) {
    return playthrough.position;
  }

  // Use whichever was updated more recently
  if (playthrough.stateCache.updatedAt > playthrough.lastEventAt) {
    return playthrough.stateCache.position;
  }

  return playthrough.position;
}

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

/**
 * Get all unsynced events for the current session.
 * Events are synced to the server, not playthroughs.
 */
export async function getAllUnsyncedEvents(session: Session) {
  // Get all playthroughs for this session
  const playthroughIds = await getDb()
    .select({ id: schema.playthroughs.id })
    .from(schema.playthroughs)
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.userEmail, session.email),
      ),
    );

  if (playthroughIds.length === 0) return [];

  return getDb().query.playbackEvents.findMany({
    where: and(
      inArray(
        schema.playbackEvents.playthroughId,
        playthroughIds.map((p) => p.id),
      ),
      isNull(schema.playbackEvents.syncedAt),
    ),
    orderBy: schema.playbackEvents.timestamp,
  });
}

/**
 * Mark events as synced after successful sync.
 */
export async function markEventsSynced(
  eventIds: string[],
  syncedAt: Date,
): Promise<void> {
  if (eventIds.length === 0) return;

  await getDb()
    .update(schema.playbackEvents)
    .set({ syncedAt })
    .where(inArray(schema.playbackEvents.id, eventIds));
}

/**
 * Upsert a playback event from server sync.
 * Events are immutable - on conflict we only update syncedAt.
 */
export async function upsertPlaybackEvent(
  event: PlaybackEventInsert,
  db: Database = getDb(),
): Promise<void> {
  // If syncedAt is provided, update it on conflict; otherwise just ignore conflict
  if (event.syncedAt !== undefined) {
    await db
      .insert(schema.playbackEvents)
      .values(event)
      .onConflictDoUpdate({
        target: schema.playbackEvents.id,
        set: {
          syncedAt: event.syncedAt,
        },
      });
  } else {
    // No syncedAt to update - just insert or ignore if already exists
    await db.insert(schema.playbackEvents).values(event).onConflictDoNothing();
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
