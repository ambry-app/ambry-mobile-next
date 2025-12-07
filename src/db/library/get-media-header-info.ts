import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, eq } from "drizzle-orm";

export type MediaHeaderInfo = Awaited<ReturnType<typeof getMediaHeaderInfo>>;

export async function getMediaHeaderInfo(session: Session, mediaId: string) {
  const media = await getMedia(session, mediaId);
  const narrators = await getNarrators(session, mediaId);
  const authors = await getAuthors(session, media.book.id);
  const series = await getSeries(session, media.book.id);

  return {
    ...media,
    narrators,
    book: {
      ...media.book,
      authors,
      series,
    },
  };
}

async function getMedia(session: Session, mediaId: string) {
  const rows = await getDb()
    .select({
      id: schema.media.id,
      fullCast: schema.media.fullCast,
      abridged: schema.media.abridged,
      thumbnails: schema.media.thumbnails,
      duration: schema.media.duration,
      mp4Path: schema.media.mp4Path,
      description: schema.media.description,
      published: schema.media.published,
      publishedFormat: schema.media.publishedFormat,
      publisher: schema.media.publisher,
      notes: schema.media.notes,
      book: {
        id: schema.books.id,
        title: schema.books.title,
        published: schema.books.published,
        publishedFormat: schema.books.publishedFormat,
      },
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.media)
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
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Media not found");
}

async function getNarrators(session: Session, mediaId: string) {
  return await getDb()
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
      },
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.narrators.url),
        eq(schema.people.id, schema.narrators.personId),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}

async function getAuthors(session: Session, bookId: string) {
  return getDb()
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
      },
    })
    .from(schema.bookAuthors)
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.authors.url),
        eq(schema.people.id, schema.authors.personId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));
}

async function getSeries(session: Session, bookId: string) {
  return await getDb()
    .select({
      id: schema.series.id,
      bookNumber: schema.seriesBooks.bookNumber,
      name: schema.series.name,
    })
    .from(schema.seriesBooks)
    .innerJoin(
      schema.series,
      and(
        eq(schema.series.url, schema.seriesBooks.url),
        eq(schema.series.id, schema.seriesBooks.seriesId),
      ),
    )
    .where(
      and(
        eq(schema.seriesBooks.url, session.url),
        eq(schema.seriesBooks.bookId, bookId),
      ),
    );
}
