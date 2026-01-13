import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import {
  getUnsyncedEvents,
  getUnsyncedPlaythroughs,
  markEventsSynced,
  markPlaythroughsSynced,
  updateStateCache,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { Thumbnails } from "@/db/schema";
import { Session } from "@/types/session";
import { groupBy } from "@/utils/group-by";
import { logBase } from "@/utils/logger";

const log = logBase.extend("db-sync");

// =============================================================================
// Library Sync - DB Operations
// =============================================================================

/**
 * Information about the last library sync for a server.
 */
export interface LibrarySyncInfo {
  lastSyncTime: Date | null;
  libraryDataVersion: Date | null;
}

/**
 * Get the last library sync info for a server.
 */
export async function getLastLibrarySyncInfo(
  session: Session,
): Promise<LibrarySyncInfo> {
  const syncedServer = await getDb().query.syncedServers.findFirst({
    where: eq(schema.syncedServers.url, session.url),
  });

  return {
    lastSyncTime: syncedServer?.lastSyncTime ?? null,
    libraryDataVersion: syncedServer?.libraryDataVersion ?? null,
  };
}

// Input types for library changes - matches GraphQL response shape
export interface LibraryChangesInput {
  peopleChangedSince: {
    id: string;
    name: string;
    description: string | null;
    thumbnails: Thumbnails | null;
    insertedAt: string;
    updatedAt: string;
  }[];
  authorsChangedSince: {
    id: string;
    person: { id: string };
    name: string;
    insertedAt: string;
    updatedAt: string;
  }[];
  narratorsChangedSince: {
    id: string;
    person: { id: string };
    name: string;
    insertedAt: string;
    updatedAt: string;
  }[];
  booksChangedSince: {
    id: string;
    title: string;
    published: string;
    publishedFormat: string;
    insertedAt: string;
    updatedAt: string;
  }[];
  bookAuthorsChangedSince: {
    id: string;
    book: { id: string };
    author: { id: string };
    insertedAt: string;
    updatedAt: string;
  }[];
  seriesChangedSince: {
    id: string;
    name: string;
    insertedAt: string;
    updatedAt: string;
  }[];
  seriesBooksChangedSince: {
    id: string;
    book: { id: string };
    series: { id: string };
    bookNumber: string;
    insertedAt: string;
    updatedAt: string;
  }[];
  mediaChangedSince: {
    id: string;
    book: { id: string };
    status: string;
    description: string | null;
    thumbnails: Thumbnails | null;
    published: string | null;
    publishedFormat: string;
    publisher: string | null;
    notes: string | null;
    abridged: boolean;
    fullCast: boolean;
    mp4Path: string | null;
    mpdPath: string | null;
    hlsPath: string | null;
    duration: string | null;
    chapters: {
      id: string;
      title: string | null;
      startTime: number;
      endTime: number;
    }[];
    supplementalFiles: {
      filename: string;
      label: string | null;
      mime: string;
      path: string;
    }[];
    insertedAt: string;
    updatedAt: string;
  }[];
  mediaNarratorsChangedSince: {
    id: string;
    media: { id: string };
    narrator: { id: string };
    insertedAt: string;
    updatedAt: string;
  }[];
  deletionsSince: {
    type: string;
    recordId: string;
  }[];
  serverTime: string;
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

/**
 * Result of applying library changes to the database.
 */
export interface ApplyLibraryChangesResult {
  newDataAsOf: Date | null;
}

/**
 * Apply library changes from the server to the local database.
 * Returns the new data version timestamp if there were changes.
 */
export async function applyLibraryChanges(
  session: Session,
  changes: LibraryChangesInput,
  previousSyncInfo: LibrarySyncInfo,
): Promise<ApplyLibraryChangesResult> {
  log.info("applying library changes...");

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

  const newDataAsOf =
    countChanges > 0 || previousSyncInfo.lastSyncTime === null
      ? serverTime
      : previousSyncInfo.libraryDataVersion;

  await getDb().transaction(async (tx) => {
    if (peopleValues.length !== 0) {
      log.debug("inserting", peopleValues.length, "people...");
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
      log.debug("people inserted");
    }

    if (authorValues.length !== 0) {
      log.debug("inserting", authorValues.length, "authors...");
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
      log.debug("authors inserted");
    }

    if (narratorValues.length !== 0) {
      log.debug(`inserting ${narratorValues.length} narrators...`);
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
      log.debug("narrators inserted");
    }

    if (booksValues.length !== 0) {
      log.debug("inserting", booksValues.length, "books...");
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
      log.debug("books inserted");
    }

    if (bookAuthorsValues.length !== 0) {
      log.debug(`inserting ${bookAuthorsValues.length} book authors...`);
      await tx
        .insert(schema.bookAuthors)
        .values(bookAuthorsValues)
        .onConflictDoUpdate({
          target: [schema.bookAuthors.url, schema.bookAuthors.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
      log.debug("book authors inserted");
    }

    if (seriesValues.length !== 0) {
      log.debug("inserting", seriesValues.length, "series...");
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
      log.debug("series inserted");
    }

    if (seriesBooksValues.length !== 0) {
      log.debug(`inserting ${seriesBooksValues.length} series books...`);
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
      log.debug("series books inserted");
    }

    if (mediaValues.length !== 0) {
      log.debug("inserting", mediaValues.length, "media...");
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
      log.debug("media inserted");
    }

    if (mediaNarratorsValues.length !== 0) {
      log.debug(`inserting ${mediaNarratorsValues.length} media narrators...`);
      await tx
        .insert(schema.mediaNarrators)
        .values(mediaNarratorsValues)
        .onConflictDoUpdate({
          target: [schema.mediaNarrators.url, schema.mediaNarrators.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
      log.debug("media narrators inserted");
    }

    for (const [deletionType, table] of Object.entries(deletionsTables)) {
      if (deletionIds[deletionType]) {
        log.debug(
          `deleting ${deletionIds[deletionType].length} ${deletionType}`,
        );
        await tx
          .delete(table)
          .where(inArray(table.id, deletionIds[deletionType]));
        log.debug(`deleted ${deletionType}`);
      }
    }

    await tx
      .insert(schema.syncedServers)
      .values({
        url: session.url,
        lastSyncTime: serverTime,
        libraryDataVersion: newDataAsOf,
      })
      .onConflictDoUpdate({
        target: [schema.syncedServers.url],
        set: {
          lastSyncTime: sql`excluded.last_sync_time`,
          libraryDataVersion: sql`excluded.library_data_version`,
        },
      });
  });

  log.info("library changes applied");
  return { newDataAsOf };
}

// =============================================================================
// Playthrough Sync - DB Operations
// =============================================================================

/**
 * Data needed to build a sync request for playthroughs.
 */
export interface PlaythroughSyncData {
  unsyncedPlaythroughs: Awaited<ReturnType<typeof getUnsyncedPlaythroughs>>;
  unsyncedEvents: Awaited<ReturnType<typeof getUnsyncedEvents>>;
  lastSyncTime: Date | null;
}

/**
 * Get all unsynced playthrough data needed for a sync request.
 */
export async function getPlaythroughSyncData(
  session: Session,
): Promise<PlaythroughSyncData> {
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

  // Get last sync time from server profile
  const serverProfile = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  log.debug(
    `found ${unsyncedPlaythroughs.length} unsynced playthroughs, ${unsyncedEvents.length} unsynced events`,
  );

  return {
    unsyncedPlaythroughs,
    unsyncedEvents,
    lastSyncTime: serverProfile?.lastSyncTime ?? null,
  };
}

// Input types for playthrough sync result - matches GraphQL response shape
export interface PlaythroughSyncResultInput {
  playthroughs: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string | null;
    abandonedAt?: string | null;
    deletedAt?: string | null;
    insertedAt: string;
    updatedAt: string;
    media: { id: string };
  }[];
  events: {
    id: string;
    playthroughId: string;
    deviceId?: string | null;
    type: string;
    timestamp: string;
    position?: number | null;
    playbackRate?: number | null;
    fromPosition?: number | null;
    toPosition?: number | null;
    previousRate?: number | null;
  }[];
  serverTime: string;
}

/**
 * Apply the result of a playthrough sync to the local database.
 * Marks sent items as synced and upserts received data.
 */
export async function applyPlaythroughSyncResult(
  session: Session,
  syncResult: PlaythroughSyncResultInput,
  sentPlaythroughIds: string[],
  sentEventIds: string[],
): Promise<void> {
  const serverTime = new Date(syncResult.serverTime);

  // Mark our sent items as synced
  if (sentPlaythroughIds.length > 0) {
    await markPlaythroughsSynced(sentPlaythroughIds, serverTime);
  }

  if (sentEventIds.length > 0) {
    await markEventsSynced(sentEventIds, serverTime);
  }

  // Batch all database operations in a single transaction for better performance
  await getDb().transaction(async (tx) => {
    // Upsert received playthroughs from server
    for (const playthrough of syncResult.playthroughs) {
      const playthroughData = {
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
        deletedAt: playthrough.deletedAt
          ? new Date(playthrough.deletedAt)
          : null,
        createdAt: new Date(playthrough.insertedAt),
        updatedAt: new Date(playthrough.updatedAt),
        syncedAt: serverTime,
      };

      await tx
        .insert(schema.playthroughs)
        .values(playthroughData)
        .onConflictDoUpdate({
          target: [schema.playthroughs.url, schema.playthroughs.id],
          set: {
            status: playthroughData.status,
            startedAt: playthroughData.startedAt,
            finishedAt: playthroughData.finishedAt,
            abandonedAt: playthroughData.abandonedAt,
            deletedAt: playthroughData.deletedAt,
            updatedAt: playthroughData.updatedAt,
            syncedAt: playthroughData.syncedAt,
          },
        });
    }

    // Bulk upsert received events from server
    if (syncResult.events.length > 0) {
      const eventDataArray = syncResult.events.map((event) => ({
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
          | "abandon"
          | "resume",
        timestamp: new Date(event.timestamp),
        position: event.position,
        playbackRate: event.playbackRate,
        fromPosition: event.fromPosition,
        toPosition: event.toPosition,
        previousRate: event.previousRate,
        syncedAt: serverTime,
      }));

      await tx
        .insert(schema.playbackEvents)
        .values(eventDataArray)
        .onConflictDoUpdate({
          target: schema.playbackEvents.id,
          set: {
            syncedAt: serverTime,
          },
        });

      // Find the newest event with position/rate for each playthrough
      // This fixes a bug where processing events out of order could store
      // an older position with a newer timestamp
      const newestByPlaythrough = new Map<
        string,
        { position: number; playbackRate: number; timestamp: Date }
      >();

      for (const event of syncResult.events) {
        if (event.position != null && event.playbackRate != null) {
          const timestamp = new Date(event.timestamp);
          const existing = newestByPlaythrough.get(event.playthroughId);

          if (!existing || timestamp > existing.timestamp) {
            newestByPlaythrough.set(event.playthroughId, {
              position: event.position,
              playbackRate: event.playbackRate,
              timestamp,
            });
          }
        }
      }

      // Update state cache once per playthrough with the newest event's data
      // updateStateCache already handles the timestamp comparison to skip
      // updates when the existing cache is more recent
      for (const [
        playthroughId,
        { position, playbackRate, timestamp },
      ] of newestByPlaythrough) {
        await updateStateCache(
          playthroughId,
          position,
          playbackRate,
          timestamp,
          tx,
        );
      }
    }

    // Update server profile with new sync time
    await tx
      .insert(schema.serverProfiles)
      .values({
        url: session.url,
        userEmail: session.email,
        lastSyncTime: serverTime,
      })
      .onConflictDoUpdate({
        target: [schema.serverProfiles.url, schema.serverProfiles.userEmail],
        set: {
          lastSyncTime: sql`excluded.last_sync_time`,
        },
      });
  });

  log.info(
    `Playthrough sync applied - received ${syncResult.playthroughs.length} playthroughs, ${syncResult.events.length} events`,
  );
}
