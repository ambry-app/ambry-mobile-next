import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import {
  getUnsyncedEvents,
  getUnsyncedPlaythroughs,
  markEventsSynced,
  markPlaythroughsSynced,
  updateStateCache,
  upsertPlaybackEvent,
  upsertPlaythrough,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import type { SyncProgressInput } from "@/graphql/api";
import {
  DeviceType,
  getLibraryChangesSince,
  getUserChangesSince,
  PlaybackEventType,
  PlaythroughStatus,
  syncProgress,
  updatePlayerState,
} from "@/graphql/api";
import {
  ExecuteAuthenticatedError,
  ExecuteAuthenticatedErrorCode,
} from "@/graphql/client/execute";
import { setLibraryDataVersion } from "@/stores/data-version";
import { useDevice } from "@/stores/device";
import { forceSignOut, Session } from "@/stores/session";

/**
 * Handles API errors from authenticated GraphQL requests.
 * Returns true if the error was handled (caller should return early),
 * false otherwise (should never happen due to exhaustiveness check).
 */
function handleApiError(
  error: ExecuteAuthenticatedError,
  context: string,
): true {
  switch (error.code) {
    case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
      console.warn(`[${context}] unauthorized, signing out...`);
      resetAndSignOut();
      return true;
    case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
      console.error(`[${context}] network error, we'll try again later`);
      return true;
    case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
    case ExecuteAuthenticatedErrorCode.GQL_ERROR:
      console.error(`[${context}] server error, we'll try again later`);
      return true;
  }
  // istanbul ignore next - exhaustiveness check, should never be reached
  error satisfies never;
}

export async function getServerSyncTimestamps(session: Session) {
  const result = await getDb()
    .select({
      lastDownSync: schema.syncedServers.lastDownSync,
      newDataAsOf: schema.syncedServers.newDataAsOf,
    })
    .from(schema.syncedServers)
    .where(eq(schema.syncedServers.url, session.url))
    .limit(1);

  return result[0] || { lastDownSync: null, newDataAsOf: null };
}

const deletionsTables = {
  MEDIA_NARRATOR: schema.mediaNarrators,
  MEDIA: schema.media,
  SERIES_BOOK: schema.seriesBooks,
  SERIES: schema.series,
  BOOK_AUTHOR: schema.bookAuthors,
  BOOK: schema.books,
  NARRATOR: schema.narrators,
  AUTHOR: schema.authors,
  PERSON: schema.people,
};

export async function syncDown(session: Session) {
  return Promise.all([syncDownLibrary(session), syncDownUser(session)]);
}

export async function syncDownLibrary(session: Session) {
  console.debug("[SyncDown] syncing library...");

  const syncedServer = await getDb().query.syncedServers.findFirst({
    where: eq(schema.syncedServers.url, session.url),
  });

  const lastSync = syncedServer?.lastDownSync;
  const result = await getLibraryChangesSince(session, lastSync);

  if (!result.success) {
    handleApiError(result.error, "SyncDown");
    return;
  }

  const changes = result.result;

  if (!changes) return;

  const peopleValues = changes.peopleChangedSince.map((person) => {
    return {
      url: session.url,
      id: person.id,
      name: person.name,
      description: person.description,
      thumbnails: person.thumbnails,
      insertedAt: new Date(person.insertedAt),
      updatedAt: new Date(person.updatedAt),
    };
  });

  const authorValues = changes.authorsChangedSince.map((author) => {
    return {
      url: session.url,
      id: author.id,
      personId: author.person.id,
      name: author.name,
      insertedAt: new Date(author.insertedAt),
      updatedAt: new Date(author.updatedAt),
    };
  });

  const narratorValues = changes.narratorsChangedSince.map((narrator) => {
    return {
      url: session.url,
      id: narrator.id,
      personId: narrator.person.id,
      name: narrator.name,
      insertedAt: new Date(narrator.insertedAt),
      updatedAt: new Date(narrator.updatedAt),
    };
  });

  const booksValues = changes.booksChangedSince.map((book) => {
    return {
      url: session.url,
      id: book.id,
      title: book.title,
      published: new Date(book.published),
      publishedFormat: book.publishedFormat.toLowerCase() as
        | "full"
        | "year_month"
        | "year",
      insertedAt: new Date(book.insertedAt),
      updatedAt: new Date(book.updatedAt),
    };
  });

  const bookAuthorsValues = changes.bookAuthorsChangedSince.map(
    (bookAuthor) => {
      return {
        url: session.url,
        id: bookAuthor.id,
        bookId: bookAuthor.book.id,
        authorId: bookAuthor.author.id,
        insertedAt: new Date(bookAuthor.insertedAt),
        updatedAt: new Date(bookAuthor.updatedAt),
      };
    },
  );

  const seriesValues = changes.seriesChangedSince.map((series) => {
    return {
      url: session.url,
      id: series.id,
      name: series.name,
      insertedAt: new Date(series.insertedAt),
      updatedAt: new Date(series.updatedAt),
    };
  });

  const seriesBooksValues = changes.seriesBooksChangedSince.map(
    (seriesBook) => {
      return {
        url: session.url,
        id: seriesBook.id,
        bookId: seriesBook.book.id,
        seriesId: seriesBook.series.id,
        bookNumber: seriesBook.bookNumber,
        insertedAt: new Date(seriesBook.insertedAt),
        updatedAt: new Date(seriesBook.updatedAt),
      };
    },
  );

  const mediaValues = changes.mediaChangedSince.map((media) => {
    return {
      url: session.url,
      id: media.id,
      status: media.status.toLowerCase() as
        | "pending"
        | "processing"
        | "error"
        | "ready",
      bookId: media.book.id,
      duration: media.duration ? media.duration.toString() : null,
      published: media.published ? new Date(media.published) : null,
      publishedFormat: media.publishedFormat.toLowerCase() as
        | "full"
        | "year_month"
        | "year",
      publisher: media.publisher,
      notes: media.notes,
      description: media.description,
      thumbnails: media.thumbnails,
      abridged: media.abridged,
      fullCast: media.fullCast,
      chapters: media.chapters,
      supplementalFiles: media.supplementalFiles,
      mp4Path: media.mp4Path,
      mpdPath: media.mpdPath,
      hlsPath: media.hlsPath,
      insertedAt: new Date(media.insertedAt),
      updatedAt: new Date(media.updatedAt),
    };
  });

  const mediaNarratorsValues = changes.mediaNarratorsChangedSince.map(
    (mediaNarrator) => {
      return {
        url: session.url,
        id: mediaNarrator.id,
        mediaId: mediaNarrator.media.id,
        narratorId: mediaNarrator.narrator.id,
        insertedAt: new Date(mediaNarrator.insertedAt),
        updatedAt: new Date(mediaNarrator.updatedAt),
      };
    },
  );

  const deletionIds = groupBy(
    changes.deletionsSince,
    (deletion) => deletion.type as string,
    (deletion) => deletion.recordId,
  );

  let newDataAsOf: Date | null = null;
  await getDb().transaction(async (tx) => {
    if (peopleValues.length !== 0) {
      console.debug("[SyncDown] inserting", peopleValues.length, "people...");
      await tx
        .insert(schema.people)
        .values(peopleValues)
        .onConflictDoUpdate({
          target: [schema.people.url, schema.people.id],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            thumbnails: sql`excluded.thumbnails`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] people inserted");
    }

    if (authorValues.length !== 0) {
      console.debug("[SyncDown] inserting", authorValues.length, "authors...");
      await tx
        .insert(schema.authors)
        .values(authorValues)
        .onConflictDoUpdate({
          target: [schema.authors.url, schema.authors.id],
          set: {
            name: sql`excluded.name`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] authors inserted");
    }

    if (narratorValues.length !== 0) {
      console.debug(
        "[SyncDown] inserting",
        narratorValues.length,
        "narrators...",
      );
      await tx
        .insert(schema.narrators)
        .values(narratorValues)
        .onConflictDoUpdate({
          target: [schema.narrators.url, schema.narrators.id],
          set: {
            name: sql`excluded.name`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] narrators inserted");
    }

    if (booksValues.length !== 0) {
      console.debug("[SyncDown] inserting", booksValues.length, "books...");
      await tx
        .insert(schema.books)
        .values(booksValues)
        .onConflictDoUpdate({
          target: [schema.books.url, schema.books.id],
          set: {
            title: sql`excluded.title`,
            published: sql`excluded.published`,
            publishedFormat: sql`excluded.published_format`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] books inserted");
    }

    if (bookAuthorsValues.length !== 0) {
      console.debug(
        "[SyncDown] inserting",
        bookAuthorsValues.length,
        "book authors...",
      );
      await tx
        .insert(schema.bookAuthors)
        .values(bookAuthorsValues)
        .onConflictDoUpdate({
          target: [schema.bookAuthors.url, schema.bookAuthors.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] book authors inserted");
    }

    if (seriesValues.length !== 0) {
      console.debug("[SyncDown] inserting", seriesValues.length, "series...");
      await tx
        .insert(schema.series)
        .values(seriesValues)
        .onConflictDoUpdate({
          target: [schema.series.url, schema.series.id],
          set: {
            name: sql`excluded.name`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] series inserted");
    }

    if (seriesBooksValues.length !== 0) {
      console.debug(
        "[SyncDown] inserting",
        seriesBooksValues.length,
        "series books...",
      );
      await tx
        .insert(schema.seriesBooks)
        .values(seriesBooksValues)
        .onConflictDoUpdate({
          target: [schema.seriesBooks.url, schema.seriesBooks.id],
          set: {
            bookNumber: sql`excluded.book_number`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] series books inserted");
    }

    if (mediaValues.length !== 0) {
      console.debug("[SyncDown] inserting", mediaValues.length, "media...");
      await tx
        .insert(schema.media)
        .values(mediaValues)
        .onConflictDoUpdate({
          target: [schema.media.url, schema.media.id],
          set: {
            status: sql`excluded.status`,
            bookId: sql`excluded.book_id`,
            duration: sql`excluded.duration`,
            published: sql`excluded.published`,
            publishedFormat: sql`excluded.published_format`,
            publisher: sql`excluded.publisher`,
            notes: sql`excluded.notes`,
            description: sql`excluded.description`,
            thumbnails: sql`excluded.thumbnails`,
            abridged: sql`excluded.abridged`,
            fullCast: sql`excluded.full_cast`,
            chapters: sql`excluded.chapters`,
            supplementalFiles: sql`excluded.supplemental_files`,
            mp4Path: sql`excluded.mp4_path`,
            mpdPath: sql`excluded.mpd_path`,
            hlsPath: sql`excluded.hls_path`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] media inserted");
    }

    if (mediaNarratorsValues.length !== 0) {
      console.debug(
        "[SyncDown] inserting",
        mediaNarratorsValues.length,
        "media narrators...",
      );
      await tx
        .insert(schema.mediaNarrators)
        .values(mediaNarratorsValues)
        .onConflictDoUpdate({
          target: [schema.mediaNarrators.url, schema.mediaNarrators.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] media narrators inserted");
    }

    for (const [deletionType, table] of Object.entries(deletionsTables)) {
      if (deletionIds[deletionType]) {
        console.debug(
          "[SyncDown] deleting",
          deletionIds[deletionType].length,
          deletionType,
        );
        await tx
          .delete(table)
          .where(inArray(table.id, deletionIds[deletionType]));
        console.debug("[SyncDown] deleted", deletionType);
      }
    }

    const serverTime = new Date(changes.serverTime);

    const countChanges =
      changes.authorsChangedSince.length +
      changes.bookAuthorsChangedSince.length +
      changes.booksChangedSince.length +
      changes.deletionsSince.length +
      changes.mediaChangedSince.length +
      changes.mediaNarratorsChangedSince.length +
      changes.narratorsChangedSince.length +
      changes.peopleChangedSince.length +
      changes.seriesBooksChangedSince.length +
      changes.seriesChangedSince.length;

    newDataAsOf =
      countChanges > 0 || syncedServer === undefined
        ? serverTime
        : syncedServer.newDataAsOf;

    await tx
      .insert(schema.syncedServers)
      .values({
        url: session.url,
        lastDownSync: serverTime,
        newDataAsOf: newDataAsOf,
      })
      .onConflictDoUpdate({
        target: [schema.syncedServers.url],
        set: {
          lastDownSync: sql`excluded.last_down_sync`,
          newDataAsOf: sql`excluded.new_data_as_of`,
        },
      });
  });

  // Update global data version store
  if (newDataAsOf) setLibraryDataVersion(newDataAsOf);

  console.debug("[SyncDown] library sync complete");
}

export async function syncDownUser(session: Session) {
  console.debug("[SyncDown] syncing user player states...");

  const serverProfile = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  const lastSync = serverProfile?.lastDownSync;
  const result = await getUserChangesSince(session, lastSync);

  if (!result.success) {
    handleApiError(result.error, "SyncDown");
    return;
  }

  const changes = result.result;

  if (!changes) return;

  const playerStatesValues = changes.playerStatesChangedSince.map(
    (playerState) => {
      return {
        url: session.url,
        id: playerState.id,
        userEmail: session.email,
        mediaId: playerState.media.id,
        status: playerState.status.toLowerCase() as
          | "not_started"
          | "in_progress"
          | "finished",
        playbackRate: playerState.playbackRate,
        position: playerState.position,
        insertedAt: new Date(playerState.insertedAt),
        updatedAt: new Date(playerState.updatedAt),
      };
    },
  );

  await getDb().transaction(async (tx) => {
    if (playerStatesValues.length !== 0) {
      console.debug(
        "[SyncDown] inserting",
        playerStatesValues.length,
        "player states...",
      );
      await tx
        .insert(schema.playerStates)
        .values(playerStatesValues)
        .onConflictDoUpdate({
          target: [schema.playerStates.url, schema.playerStates.id],
          set: {
            status: sql`excluded.status`,
            playbackRate: sql`excluded.playback_rate`,
            position: sql`excluded.position`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.debug("[SyncDown] player states inserted");
    }

    const serverTime = new Date(changes.serverTime);

    const countChanges = changes.playerStatesChangedSince.length;

    const newDataAsOf =
      countChanges > 0 || serverProfile === undefined
        ? serverTime
        : serverProfile.newDataAsOf;

    await tx
      .insert(schema.serverProfiles)
      .values({
        url: session.url,
        userEmail: session.email,
        lastDownSync: serverTime,
        newDataAsOf: newDataAsOf,
      })
      .onConflictDoUpdate({
        target: [schema.serverProfiles.url, schema.serverProfiles.userEmail],
        set: {
          lastDownSync: sql`excluded.last_down_sync`,
          newDataAsOf: sql`excluded.new_data_as_of`,
        },
      });
  });

  console.debug("[SyncDown] user player state sync complete");
}

export async function syncUp(session: Session) {
  console.debug("[SyncUp] syncing...");

  const server = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  const lastSync = server?.lastUpSync;
  const now = new Date();

  const changedPlayerStates = await getDb().query.localPlayerStates.findMany({
    columns: { mediaId: true, playbackRate: true, position: true },
    where: and(
      eq(schema.localPlayerStates.url, session.url),
      eq(schema.localPlayerStates.userEmail, session.email),
      gte(schema.localPlayerStates.updatedAt, lastSync || new Date(0)),
    ),
  });

  console.debug(
    "[SyncUp] syncing",
    changedPlayerStates.length,
    "player states",
  );

  for (const playerState of changedPlayerStates) {
    const result = await updatePlayerState(
      session,
      playerState.mediaId,
      playerState.position,
      playerState.playbackRate,
    );

    if (!result.success) {
      handleApiError(result.error, "SyncUp");
      return;
    }
  }

  console.debug("[SyncUp] server request(s) complete");

  await getDb()
    .insert(schema.serverProfiles)
    .values({
      url: session.url,
      userEmail: session.email,
      lastUpSync: now,
    })
    .onConflictDoUpdate({
      target: [schema.serverProfiles.url, schema.serverProfiles.userEmail],
      set: {
        lastUpSync: sql`excluded.last_up_sync`,
      },
    });

  console.debug("[SyncUp] sync complete");
}

// =============================================================================
// Playthrough Sync (new event-sourced model)
// =============================================================================

export async function syncPlaythroughs(session: Session) {
  console.debug("[SyncPlaythroughs] starting...");

  // Get device info from store (should be initialized at boot)
  const deviceInfo = useDevice.getState().deviceInfo;
  if (!deviceInfo) {
    console.warn("[SyncPlaythroughs] Device not initialized, skipping");
    return;
  }

  // Get unsynced playthroughs
  const unsyncedPlaythroughs = await getUnsyncedPlaythroughs(session);

  // Get all playthrough IDs (both synced and unsynced) to fetch their unsynced events
  const allPlaythroughIds = await getDb()
    .select({ id: schema.playthroughs.id })
    .from(schema.playthroughs)
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.userEmail, session.email),
      ),
    );

  const unsyncedEvents = await getUnsyncedEvents(
    allPlaythroughIds.map((p) => p.id),
  );

  console.debug(
    "[SyncPlaythroughs] found",
    unsyncedPlaythroughs.length,
    "unsynced playthroughs,",
    unsyncedEvents.length,
    "unsynced events",
  );

  // Get last sync time from server profile
  const serverProfile = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  // Map local device type to GraphQL enum
  const deviceTypeMap: Record<string, DeviceType> = {
    ios: DeviceType.Ios,
    android: DeviceType.Android,
    web: DeviceType.Web,
  };

  // Map local playthrough status to GraphQL enum
  const playthroughStatusMap: Record<string, PlaythroughStatus> = {
    in_progress: PlaythroughStatus.InProgress,
    finished: PlaythroughStatus.Finished,
    abandoned: PlaythroughStatus.Abandoned,
  };

  // Map local event type to GraphQL enum
  const eventTypeMap: Record<string, PlaybackEventType> = {
    start: PlaybackEventType.Start,
    play: PlaybackEventType.Play,
    pause: PlaybackEventType.Pause,
    seek: PlaybackEventType.Seek,
    rate_change: PlaybackEventType.RateChange,
    finish: PlaybackEventType.Finish,
    abandon: PlaybackEventType.Abandon,
  };

  // Prepare input for syncProgress mutation
  const input: SyncProgressInput = {
    lastSyncTime: serverProfile?.lastDownSync ?? null,
    device: {
      id: deviceInfo.id,
      type: deviceTypeMap[deviceInfo.type] ?? DeviceType.Web,
      brand: deviceInfo.brand,
      modelName: deviceInfo.modelName,
      osName: deviceInfo.osName,
      osVersion: deviceInfo.osVersion,
    },
    playthroughs: unsyncedPlaythroughs.map((p) => ({
      id: p.id,
      mediaId: p.mediaId,
      status: playthroughStatusMap[p.status] ?? PlaythroughStatus.InProgress,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      abandonedAt: p.abandonedAt,
      deletedAt: p.deletedAt,
    })),
    events: unsyncedEvents.map((e) => ({
      id: e.id,
      playthroughId: e.playthroughId,
      type: eventTypeMap[e.type] ?? PlaybackEventType.Play,
      timestamp: e.timestamp,
      position: e.position,
      playbackRate: e.playbackRate,
      fromPosition: e.fromPosition,
      toPosition: e.toPosition,
      previousRate: e.previousRate,
    })),
  };

  // Call the sync mutation
  const result = await syncProgress(session, input);

  if (!result.success) {
    handleApiError(result.error, "SyncPlaythroughs");
    return;
  }

  const syncResult = result.result.syncProgress;
  if (!syncResult) return;

  const serverTime = new Date(syncResult.serverTime);

  // Mark our sent items as synced
  if (unsyncedPlaythroughs.length > 0) {
    await markPlaythroughsSynced(
      unsyncedPlaythroughs.map((p) => p.id),
      serverTime,
    );
  }

  if (unsyncedEvents.length > 0) {
    await markEventsSynced(
      unsyncedEvents.map((e) => e.id),
      serverTime,
    );
  }

  // Upsert received playthroughs from server
  for (const playthrough of syncResult.playthroughs) {
    await upsertPlaythrough({
      id: playthrough.id,
      url: session.url,
      userEmail: session.email,
      mediaId: playthrough.media.id,
      status: playthrough.status.toLowerCase() as
        | "in_progress"
        | "finished"
        | "abandoned",
      startedAt: new Date(playthrough.startedAt),
      finishedAt: playthrough.finishedAt
        ? new Date(playthrough.finishedAt)
        : null,
      abandonedAt: playthrough.abandonedAt
        ? new Date(playthrough.abandonedAt)
        : null,
      deletedAt: playthrough.deletedAt ? new Date(playthrough.deletedAt) : null,
      createdAt: new Date(playthrough.insertedAt),
      updatedAt: new Date(playthrough.updatedAt),
      syncedAt: serverTime,
    });
  }

  // Upsert received events from server
  for (const event of syncResult.events) {
    await upsertPlaybackEvent({
      id: event.id,
      playthroughId: event.playthroughId,
      deviceId: event.deviceId,
      type: event.type.toLowerCase() as
        | "start"
        | "play"
        | "pause"
        | "seek"
        | "rate_change"
        | "finish"
        | "abandon",
      timestamp: new Date(event.timestamp),
      position: event.position,
      playbackRate: event.playbackRate,
      fromPosition: event.fromPosition,
      toPosition: event.toPosition,
      previousRate: event.previousRate,
      syncedAt: serverTime,
    });

    // Update state cache for received events (if playback event with position)
    if (event.position != null && event.playbackRate != null) {
      await updateStateCache(
        event.playthroughId,
        event.position,
        event.playbackRate,
        new Date(event.timestamp),
      );
    }
  }

  // Update server profile with new sync time
  await getDb()
    .insert(schema.serverProfiles)
    .values({
      url: session.url,
      userEmail: session.email,
      lastDownSync: serverTime,
    })
    .onConflictDoUpdate({
      target: [schema.serverProfiles.url, schema.serverProfiles.userEmail],
      set: {
        lastDownSync: sql`excluded.last_down_sync`,
      },
    });

  console.debug(
    "[SyncPlaythroughs] complete - received",
    syncResult.playthroughs.length,
    "playthroughs,",
    syncResult.events.length,
    "events",
  );
}

function resetAndSignOut() {
  // Just sign out - the player will clean up reactively via session subscription
  forceSignOut();
}

const groupBy = <T, K extends keyof any, V>(
  list: T[],
  getKey: (item: T) => K,
  getValue: (item: T) => V,
) => {
  return list.reduce(
    (previous, currentItem) => {
      const group = getKey(currentItem);
      if (!previous[group]) previous[group] = [];
      previous[group].push(getValue(currentItem));
      return previous;
    },
    {} as Record<K, V[]>,
  );
};
