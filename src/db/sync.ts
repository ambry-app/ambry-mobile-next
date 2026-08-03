import { and, eq, inArray, sql } from "drizzle-orm";

import { chunkBoundValues, chunkRowsForInsert } from "@/db/chunk";
import { getDb } from "@/db/db";
import { rebuildPlaythroughs } from "@/db/playthrough-reducer";
import {
  getAllUnsyncedEvents,
  markEventsSynced,
  upsertPlaybackEvents,
} from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { PlaybackEventType, Thumbnails } from "@/db/schema";
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
 * Called as rows are written so callers can show progress. `detail` names what
 * is being written right now ("books"), and the counts are across everything
 * the call will write, not just the current step.
 */
export type ApplyProgressCallback = (progress: {
  detail: string;
  current: number;
  total: number;
}) => void;

/**
 * Tracks how far through a bulk write we are. `step` announces a new kind of
 * row; `wrote` records rows that have landed.
 */
function progressReporter(total: number, onProgress?: ApplyProgressCallback) {
  let detail = "";
  let current = 0;

  const emit = () => onProgress?.({ detail, current, total });

  return {
    step(nextDetail: string) {
      detail = nextDetail;
      emit();
    },
    wrote(rows: number) {
      current += rows;
      emit();
    },
  };
}

/**
 * Apply library changes from the server to the local database.
 * Returns the new data version timestamp if there were changes.
 */
export async function applyLibraryChanges(
  session: Session,
  changes: LibraryChangesInput,
  previousSyncInfo: LibrarySyncInfo,
  onProgress?: ApplyProgressCallback,
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

  // Deletions are excluded: they are a single statement per type and would make
  // the bar jump rather than describe the work that actually takes time.
  const progress = progressReporter(
    peopleValues.length +
      authorValues.length +
      narratorValues.length +
      booksValues.length +
      bookAuthorsValues.length +
      seriesValues.length +
      seriesBooksValues.length +
      mediaValues.length +
      mediaNarratorsValues.length,
    onProgress,
  );

  await getDb().transaction(async (tx) => {
    if (peopleValues.length !== 0) {
      log.debug("inserting", peopleValues.length, "people...");
      progress.step("people");
      for (const rows of chunkRowsForInsert(schema.people, peopleValues)) {
        await tx
          .insert(schema.people)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.people.url, schema.people.id],
            set: {
              name: sql`excluded.name`,
              description: sql`excluded.description`,
              thumbnails: sql`excluded.thumbnails`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("people inserted");
    }

    if (authorValues.length !== 0) {
      log.debug("inserting", authorValues.length, "authors...");
      progress.step("authors");
      for (const rows of chunkRowsForInsert(schema.authors, authorValues)) {
        await tx
          .insert(schema.authors)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.authors.url, schema.authors.id],
            set: {
              personId: sql`excluded.person_id`,
              name: sql`excluded.name`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("authors inserted");
    }

    if (narratorValues.length !== 0) {
      log.debug(`inserting ${narratorValues.length} narrators...`);
      progress.step("narrators");
      for (const rows of chunkRowsForInsert(schema.narrators, narratorValues)) {
        await tx
          .insert(schema.narrators)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.narrators.url, schema.narrators.id],
            set: {
              personId: sql`excluded.person_id`,
              name: sql`excluded.name`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("narrators inserted");
    }

    if (booksValues.length !== 0) {
      log.debug("inserting", booksValues.length, "books...");
      progress.step("books");
      for (const rows of chunkRowsForInsert(schema.books, booksValues)) {
        await tx
          .insert(schema.books)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.books.url, schema.books.id],
            set: {
              title: sql`excluded.title`,
              published: sql`excluded.published`,
              publishedFormat: sql`excluded.published_format`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("books inserted");
    }

    if (bookAuthorsValues.length !== 0) {
      log.debug(`inserting ${bookAuthorsValues.length} book authors...`);
      progress.step("book authors");
      for (const rows of chunkRowsForInsert(
        schema.bookAuthors,
        bookAuthorsValues,
      )) {
        await tx
          .insert(schema.bookAuthors)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.bookAuthors.url, schema.bookAuthors.id],
            set: {
              bookId: sql`excluded.book_id`,
              authorId: sql`excluded.author_id`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("book authors inserted");
    }

    if (seriesValues.length !== 0) {
      log.debug("inserting", seriesValues.length, "series...");
      progress.step("series");
      for (const rows of chunkRowsForInsert(schema.series, seriesValues)) {
        await tx
          .insert(schema.series)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.series.url, schema.series.id],
            set: {
              name: sql`excluded.name`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("series inserted");
    }

    if (seriesBooksValues.length !== 0) {
      log.debug(`inserting ${seriesBooksValues.length} series books...`);
      progress.step("series books");
      for (const rows of chunkRowsForInsert(
        schema.seriesBooks,
        seriesBooksValues,
      )) {
        await tx
          .insert(schema.seriesBooks)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.seriesBooks.url, schema.seriesBooks.id],
            set: {
              bookId: sql`excluded.book_id`,
              seriesId: sql`excluded.series_id`,
              bookNumber: sql`excluded.book_number`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("series books inserted");
    }

    if (mediaValues.length !== 0) {
      log.debug("inserting", mediaValues.length, "media...");
      progress.step("media");
      for (const rows of chunkRowsForInsert(schema.media, mediaValues)) {
        await tx
          .insert(schema.media)
          .values(rows)
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
        progress.wrote(rows.length);
      }
      log.debug("media inserted");
    }

    if (mediaNarratorsValues.length !== 0) {
      log.debug(`inserting ${mediaNarratorsValues.length} media narrators...`);
      progress.step("narrations");
      for (const rows of chunkRowsForInsert(
        schema.mediaNarrators,
        mediaNarratorsValues,
      )) {
        await tx
          .insert(schema.mediaNarrators)
          .values(rows)
          .onConflictDoUpdate({
            target: [schema.mediaNarrators.url, schema.mediaNarrators.id],
            set: {
              mediaId: sql`excluded.media_id`,
              narratorId: sql`excluded.narrator_id`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
        progress.wrote(rows.length);
      }
      log.debug("media narrators inserted");
    }

    for (const [deletionType, table] of Object.entries(deletionsTables)) {
      if (deletionIds[deletionType]) {
        log.debug(
          `deleting ${deletionIds[deletionType].length} ${deletionType}`,
        );
        for (const ids of chunkBoundValues(deletionIds[deletionType])) {
          await tx.delete(table).where(inArray(table.id, ids));
        }
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
// Event Sync - DB Operations (V2 - events only, playthroughs derived)
// =============================================================================

/**
 * Data needed to build a sync request.
 * V2: Only events are synced, playthroughs are derived from events.
 */
export interface EventSyncData {
  unsyncedEvents: Awaited<ReturnType<typeof getAllUnsyncedEvents>>;
  lastSyncTime: Date | null;
}

/**
 * Get all unsynced event data needed for a sync request.
 */
export async function getEventSyncData(
  session: Session,
): Promise<EventSyncData> {
  // Get unsynced events for this session
  const unsyncedEvents = await getAllUnsyncedEvents(session);

  // Get last sync time from server profile
  const serverProfile = await getDb().query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  log.debug(`found ${unsyncedEvents.length} unsynced events`);

  return {
    unsyncedEvents,
    lastSyncTime: serverProfile?.lastSyncTime ?? null,
  };
}

// Input types for event sync result - matches GraphQL syncEvents response shape
export interface EventSyncResultInput {
  events: {
    id: string;
    playthroughId: string;
    deviceId?: string | null;
    mediaId?: string | null;
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
 * Apply the result of an event sync to the local database.
 *
 * V2 flow:
 * 1. Mark sent events as synced
 * 2. Upsert received events from server
 * 3. Rebuild affected playthroughs from their events
 *
 * Playthroughs are never synced directly - they are 100% derived from events.
 */
export async function applyEventSyncResult(
  session: Session,
  syncResult: EventSyncResultInput,
  sentEventIds: string[],
  onProgress?: ApplyProgressCallback,
): Promise<void> {
  const serverTime = new Date(syncResult.serverTime);

  // Track which playthroughs need rebuilding
  const affectedPlaythroughIds = new Set<string>();

  const eventsPayload: schema.PlaybackEventInsert[] = syncResult.events.map(
    (event) => {
      affectedPlaythroughIds.add(event.playthroughId);

      return {
        id: event.id,
        playthroughId: event.playthroughId,
        deviceId: event.deviceId,
        mediaId: event.mediaId,
        type: event.type.toLowerCase() as PlaybackEventType,
        timestamp: new Date(event.timestamp),
        position: event.position,
        playbackRate: event.playbackRate,
        fromPosition: event.fromPosition,
        toPosition: event.toPosition,
        previousRate: event.previousRate,
        syncedAt: serverTime,
      };
    },
  );

  // Rebuilding walks each affected playthrough one at a time, so it is counted
  // alongside the events themselves rather than left as a silent tail
  const progress = progressReporter(
    eventsPayload.length + affectedPlaythroughIds.size,
    onProgress,
  );

  await getDb().transaction(async (tx) => {
    // Mark sent events as synced
    if (sentEventIds.length > 0) {
      await markEventsSynced(sentEventIds, serverTime, tx);
    }

    // Upsert received events from server
    if (syncResult.events.length > 0) {
      progress.step("listening history");
      await upsertPlaybackEvents(eventsPayload, tx, (rows) =>
        progress.wrote(rows),
      );
    }

    // Rebuild affected playthroughs from their events
    // This ensures client and server have identical derived state
    if (affectedPlaythroughIds.size > 0) {
      progress.step("playback positions");
    }
    await rebuildPlaythroughs(
      Array.from(affectedPlaythroughIds),
      session,
      tx,
      serverTime,
      (count) => progress.wrote(count),
    );

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

  log.info(`Event sync applied - received ${syncResult.events.length} events`);
}
