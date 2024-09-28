import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { graphql } from "@/graphql/client";
import { execute } from "@/graphql/client/execute";
import { eq, inArray, sql } from "drizzle-orm";

const syncQuery = graphql(`
  query Sync($since: DateTime) {
    peopleChangedSince(since: $since) {
      id
      name
      description
      thumbnails {
        extraLarge
        large
        medium
        small
        extraSmall
        thumbhash
      }
      insertedAt
      updatedAt
    }
    authorsChangedSince(since: $since) {
      id
      person {
        id
      }
      name
      insertedAt
      updatedAt
    }
    narratorsChangedSince(since: $since) {
      id
      person {
        id
      }
      name
      insertedAt
      updatedAt
    }
    booksChangedSince(since: $since) {
      id
      title
      published
      publishedFormat
      insertedAt
      updatedAt
    }
    bookAuthorsChangedSince(since: $since) {
      id
      book {
        id
      }
      author {
        id
      }
      insertedAt
      updatedAt
    }
    seriesChangedSince(since: $since) {
      id
      name
      insertedAt
      updatedAt
    }
    seriesBooksChangedSince(since: $since) {
      id
      book {
        id
      }
      series {
        id
      }
      bookNumber
      insertedAt
      updatedAt
    }
    mediaChangedSince(since: $since) {
      id
      book {
        id
      }
      status
      description
      thumbnails {
        extraLarge
        large
        medium
        small
        extraSmall
        thumbhash
      }
      published
      publishedFormat
      abridged
      fullCast
      mp4Path
      mpdPath
      hlsPath
      duration
      # TODO:
      # chapters
      insertedAt
      updatedAt
    }
    mediaNarratorsChangedSince(since: $since) {
      id
      media {
        id
      }
      narrator {
        id
      }
      insertedAt
      updatedAt
    }
    deletionsSince(since: $since) {
      type
      recordId
    }
    serverTime
  }
`);

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

export async function sync(url: string, token: string) {
  console.log("syncing...");

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.url, url),
  });

  const lastSync = server?.lastSync;

  const response = await execute(url, token, syncQuery, {
    since: lastSync,
  });

  const peopleValues = response.peopleChangedSince.map((person) => {
    return {
      url: url,
      id: person.id,
      name: person.name,
      description: person.description,
      thumbnails: person.thumbnails,
      insertedAt: new Date(person.insertedAt),
      updatedAt: new Date(person.updatedAt),
    };
  });

  const authorValues = response.authorsChangedSince.map((author) => {
    return {
      url: url,
      id: author.id,
      personId: author.person.id,
      name: author.name,
      insertedAt: new Date(author.insertedAt),
      updatedAt: new Date(author.updatedAt),
    };
  });

  const narratorValues = response.narratorsChangedSince.map((narrator) => {
    return {
      url: url,
      id: narrator.id,
      personId: narrator.person.id,
      name: narrator.name,
      insertedAt: new Date(narrator.insertedAt),
      updatedAt: new Date(narrator.updatedAt),
    };
  });

  const booksValues = response.booksChangedSince.map((book) => {
    return {
      url: url,
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

  const bookAuthorsValues = response.bookAuthorsChangedSince.map(
    (bookAuthor) => {
      return {
        url: url,
        id: bookAuthor.id,
        bookId: bookAuthor.book.id,
        authorId: bookAuthor.author.id,
        insertedAt: new Date(bookAuthor.insertedAt),
        updatedAt: new Date(bookAuthor.updatedAt),
      };
    },
  );

  const seriesValues = response.seriesChangedSince.map((series) => {
    return {
      url: url,
      id: series.id,
      name: series.name,
      insertedAt: new Date(series.insertedAt),
      updatedAt: new Date(series.updatedAt),
    };
  });

  const seriesBooksValues = response.seriesBooksChangedSince.map(
    (seriesBook) => {
      return {
        url: url,
        id: seriesBook.id,
        bookId: seriesBook.book.id,
        seriesId: seriesBook.series.id,
        bookNumber: seriesBook.bookNumber,
        insertedAt: new Date(seriesBook.insertedAt),
        updatedAt: new Date(seriesBook.updatedAt),
      };
    },
  );

  const mediaValues = response.mediaChangedSince.map((media) => {
    return {
      url: url,
      id: media.id,
      status: media.status.toLowerCase() as
        | "pending"
        | "processing"
        | "error"
        | "ready",
      bookId: media.book.id,
      duration: media.duration ? media.duration.toString() : null,
      published: new Date(media.published),
      publishedFormat: media.publishedFormat.toLowerCase() as
        | "full"
        | "year_month"
        | "year",
      description: media.description,
      thumbnails: media.thumbnails,
      abridged: media.abridged,
      fullCast: media.fullCast,
      chapters: [],
      mp4Path: media.mp4Path,
      mpdPath: media.mpdPath,
      hlsPath: media.hlsPath,
      insertedAt: new Date(media.insertedAt),
      updatedAt: new Date(media.updatedAt),
    };
  });

  const mediaNarratorsValues = response.mediaNarratorsChangedSince.map(
    (mediaNarrator) => {
      return {
        url: url,
        id: mediaNarrator.id,
        mediaId: mediaNarrator.media.id,
        narratorId: mediaNarrator.narrator.id,
        insertedAt: new Date(mediaNarrator.insertedAt),
        updatedAt: new Date(mediaNarrator.updatedAt),
      };
    },
  );

  const deletionIds = groupBy(
    response.deletionsSince,
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

    for (const [deletionType, table] of Object.entries(deletionsTables)) {
      if (deletionIds[deletionType]) {
        await tx
          .delete(table)
          .where(inArray(table.id, deletionIds[deletionType]));
      }
    }

    await tx
      .insert(schema.servers)
      .values({ url: url, lastSync: new Date(response.serverTime) })
      .onConflictDoUpdate({
        target: [schema.servers.url],
        set: {
          lastSync: sql`excluded.last_sync`,
        },
      });

    console.log("sync complete");
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
