import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { getChangesSince, updatePlayerState } from "@/src/graphql/api";
import { Session } from "@/src/stores/session";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

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
  console.log("down syncing...");

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.url, session.url),
  });

  const lastSync = server?.lastDownSync;

  if (lastSync) {
    // WARNING: treating server-time and client-time as the same
    // but it's ok because this is just a debounce
    const now = Date.now();
    const lastSyncTime = lastSync.getTime();
    if (now - lastSyncTime < 60 * 1000) {
      console.log("down synced less than a minute ago, skipping sync");
      return;
    }
  }

  const allChanges = await getChangesSince(session, lastSync);

  if (!allChanges) return;

  const peopleValues = allChanges.peopleChangedSince.map((person) => {
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

  const authorValues = allChanges.authorsChangedSince.map((author) => {
    return {
      url: session.url,
      id: author.id,
      personId: author.person.id,
      name: author.name,
      insertedAt: new Date(author.insertedAt),
      updatedAt: new Date(author.updatedAt),
    };
  });

  const narratorValues = allChanges.narratorsChangedSince.map((narrator) => {
    return {
      url: session.url,
      id: narrator.id,
      personId: narrator.person.id,
      name: narrator.name,
      insertedAt: new Date(narrator.insertedAt),
      updatedAt: new Date(narrator.updatedAt),
    };
  });

  const booksValues = allChanges.booksChangedSince.map((book) => {
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

  const bookAuthorsValues = allChanges.bookAuthorsChangedSince.map(
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

  const seriesValues = allChanges.seriesChangedSince.map((series) => {
    return {
      url: session.url,
      id: series.id,
      name: series.name,
      insertedAt: new Date(series.insertedAt),
      updatedAt: new Date(series.updatedAt),
    };
  });

  const seriesBooksValues = allChanges.seriesBooksChangedSince.map(
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

  const mediaValues = allChanges.mediaChangedSince.map((media) => {
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

  const mediaNarratorsValues = allChanges.mediaNarratorsChangedSince.map(
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

  const playerStatesValues = allChanges.playerStatesChangedSince.map(
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

  const deletionIds = groupBy(
    allChanges.deletionsSince,
    (deletion) => deletion.type as string,
    (deletion) => deletion.recordId,
  );

  await db.transaction(async (tx) => {
    if (peopleValues.length !== 0) {
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
    }

    if (authorValues.length !== 0) {
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
    }

    if (narratorValues.length !== 0) {
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
    }

    if (booksValues.length !== 0) {
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
    }

    if (bookAuthorsValues.length !== 0) {
      await tx
        .insert(schema.bookAuthors)
        .values(bookAuthorsValues)
        .onConflictDoUpdate({
          target: [schema.bookAuthors.url, schema.bookAuthors.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    if (seriesValues.length !== 0) {
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
    }

    if (seriesBooksValues.length !== 0) {
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
    }

    if (mediaValues.length !== 0) {
      await tx
        .insert(schema.media)
        .values(mediaValues)
        .onConflictDoUpdate({
          target: [schema.media.url, schema.media.id],
          set: {
            bookId: sql`excluded.book_id`,
            published: sql`excluded.published`,
            publishedFormat: sql`excluded.published_format`,
            description: sql`excluded.description`,
            thumbnails: sql`excluded.thumbnails`,
            abridged: sql`excluded.abridged`,
            fullCast: sql`excluded.full_cast`,
            duration: sql`excluded.duration`,
            hlsPath: sql`excluded.hls_path`,
            mp4Path: sql`excluded.mp4_path`,
            mpdPath: sql`excluded.mpd_path`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    if (mediaNarratorsValues.length !== 0) {
      await tx
        .insert(schema.mediaNarrators)
        .values(mediaNarratorsValues)
        .onConflictDoUpdate({
          target: [schema.mediaNarrators.url, schema.mediaNarrators.id],
          set: {
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    if (playerStatesValues.length !== 0) {
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
    }

    for (const [deletionType, table] of Object.entries(deletionsTables)) {
      if (deletionIds[deletionType]) {
        await tx
          .delete(table)
          .where(inArray(table.id, deletionIds[deletionType]));
      }
    }

    await tx
      .insert(schema.servers)
      .values({
        url: session.url,
        userEmail: session.email,
        lastDownSync: new Date(allChanges.serverTime),
      })
      .onConflictDoUpdate({
        target: [schema.servers.url, schema.servers.userEmail],
        set: {
          lastDownSync: sql`excluded.last_down_sync`,
        },
      });
  });

  console.log("down sync complete");
}

export async function syncUp(session: Session) {
  console.log("up syncing...");

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.url, session.url),
  });

  const lastSync = server?.lastUpSync;

  if (lastSync) {
    const now = Date.now();
    const lastSyncTime = lastSync.getTime();
    if (now - lastSyncTime < 60 * 1000) {
      console.log("up synced less than a minute ago, skipping sync");
      return;
    }
  }

  const now = new Date();

  const changedPlayerStates = await db.query.localPlayerStates.findMany({
    columns: { mediaId: true, playbackRate: true, position: true },
    where: and(
      eq(schema.localPlayerStates.url, session.url),
      eq(schema.localPlayerStates.userEmail, session.email),
      gte(schema.localPlayerStates.updatedAt, lastSync || new Date(0)),
    ),
  });

  console.log("syncing", changedPlayerStates.length, "player states");

  for (const playerState of changedPlayerStates) {
    await updatePlayerState(
      session,
      playerState.mediaId,
      playerState.position,
      playerState.playbackRate,
    );
  }

  console.log("server request(s) complete");

  console.log("values", {
    url: session.url,
    userEmail: session.email,
    lastUpSync: now,
  });

  await db
    .insert(schema.servers)
    .values({
      url: session.url,
      userEmail: session.email,
      lastUpSync: now,
    })
    .onConflictDoUpdate({
      target: [schema.servers.url, schema.servers.userEmail],
      set: {
        lastUpSync: sql`excluded.last_up_sync`,
      },
    });
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
