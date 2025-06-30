import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import {
  getLibraryChangesSince,
  getUserChangesSince,
  updatePlayerState,
} from "@/src/graphql/api";
import { ExecuteAuthenticatedErrorCode } from "@/src/graphql/client/execute";
import { useDataVersion } from "@/src/stores/dataVersion";
import { forceUnloadPlayer } from "@/src/stores/player";
import { Session, forceSignOut } from "@/src/stores/session";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";

export function useLastDownSync(session: Session) {
  const query = db
    .select({ lastDownSync: schema.syncedServers.lastDownSync })
    .from(schema.syncedServers)
    .where(eq(schema.syncedServers.url, session.url))
    .limit(1);

  const { data } = useLiveQuery(query);

  return data[0]?.lastDownSync || undefined;
}

export async function getServerSyncTimestamps(session: Session) {
  const result = await db
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

  const syncedServer = await db.query.syncedServers.findFirst({
    where: eq(schema.syncedServers.url, session.url),
  });

  const lastSync = syncedServer?.lastDownSync;
  const result = await getLibraryChangesSince(session, lastSync);

  if (!result.success) {
    switch (result.error.code) {
      case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
        console.warn("[SyncDown] unauthorized, signing out...");
        await resetAndSignOut();
        return;
      case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
        console.error("[SyncDown] network error, we'll try again later");
        return;
      case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
      case ExecuteAuthenticatedErrorCode.GQL_ERROR:
        console.error("[SyncDown] server error, we'll try again later");
        return;
      default:
        return result.error satisfies never;
    }
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
  await db.transaction(async (tx) => {
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
  if (newDataAsOf) useDataVersion.getState().setLibraryDataVersion(newDataAsOf);

  console.debug("[SyncDown] library sync complete");
}

export async function syncDownUser(session: Session) {
  console.debug("[SyncDown] syncing user player states...");

  const serverProfile = await db.query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  const lastSync = serverProfile?.lastDownSync;
  const result = await getUserChangesSince(session, lastSync);

  if (!result.success) {
    switch (result.error.code) {
      case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
        console.warn("[SyncDown] unauthorized, signing out...");
        await resetAndSignOut();
        return;
      case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
        console.error("[SyncDown] network error, we'll try again later");
        return;
      case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
      case ExecuteAuthenticatedErrorCode.GQL_ERROR:
        console.error("[SyncDown] server error, we'll try again later");
        return;
      default:
        return result.error satisfies never;
    }
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

  await db.transaction(async (tx) => {
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

  const server = await db.query.serverProfiles.findFirst({
    where: and(
      eq(schema.serverProfiles.url, session.url),
      eq(schema.serverProfiles.userEmail, session.email),
    ),
  });

  const lastSync = server?.lastUpSync;
  const now = new Date();

  const changedPlayerStates = await db.query.localPlayerStates.findMany({
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
      switch (result.error.code) {
        case ExecuteAuthenticatedErrorCode.UNAUTHORIZED:
          console.warn("[SyncUp] unauthorized, signing out...");
          await resetAndSignOut();
          return;
        case ExecuteAuthenticatedErrorCode.NETWORK_ERROR:
          console.error("[SyncUp] network error, we'll try again later");
          return;
        case ExecuteAuthenticatedErrorCode.SERVER_ERROR:
        case ExecuteAuthenticatedErrorCode.GQL_ERROR:
          console.error("[SyncUp] server error, we'll try again later");
          return;
        default:
          return result.error satisfies never;
      }
    }
  }

  console.debug("[SyncUp] server request(s) complete");

  await db
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

async function resetAndSignOut() {
  await forceUnloadPlayer();
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
