import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type PersonWithNarratedMedia = Awaited<
  ReturnType<typeof getPersonWithNarratedMedia>
>;

export async function getPersonWithNarratedMedia(
  session: Session,
  personId: string,
) {
  const person = await getPerson(session, personId);
  const personNarrators = await getNarrators(session, personId);

  const narratorIds = personNarrators.map((n) => n.id);
  const media = await getMediaForNarrators(session, narratorIds);

  const bookIds = media.map((m) => m.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByNarratorId = Object.groupBy(media, (m) => m.narratorId);
  const narratorsByMediaId = Object.groupBy(narrators, (n) => n.mediaId);

  return {
    ...person,
    narrators: personNarrators.map((narrator) => ({
      ...narrator,
      media: (mediaByNarratorId[narrator.id] ?? []).map(
        ({ narratorId, ...media }) => ({
          ...media,
          book: {
            ...media.book,
            authors: (authorsByBookId[media.book.id] ?? []).map(
              ({ bookId, ...author }) => author,
            ),
          },
          narrators: (narratorsByMediaId[media.id] ?? []).map(
            ({ mediaId, ...narrator }) => narrator,
          ),
        }),
      ),
    })),
  };
}

async function getPerson(session: Session, personId: string) {
  const person = await db.query.people.findFirst({
    columns: {
      name: true,
    },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
  });

  return requireValue(person, "Person not found");
}

async function getNarrators(session: Session, personId: string) {
  return db
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
    })
    .from(schema.narrators)
    .where(
      and(
        eq(schema.narrators.url, session.url),
        eq(schema.narrators.personId, personId),
      ),
    )
    .orderBy(asc(schema.narrators.name));
}

async function getMediaForNarrators(session: Session, narratorIds: string[]) {
  if (narratorIds.length === 0) return [];
  return db
    .select({
      id: schema.media.id,
      narratorId: schema.mediaNarrators.narratorId,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.mediaNarrators.url),
        eq(schema.media.id, schema.mediaNarrators.mediaId),
      ),
    )
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
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.narratorId, narratorIds),
      ),
    )
    .orderBy(desc(schema.media.published));
}

async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return [];

  return db
    .select({
      bookId: schema.bookAuthors.bookId,
      name: schema.authors.name,
    })
    .from(schema.bookAuthors)
    .innerJoin(
      schema.authors,
      and(
        eq(schema.authors.url, schema.bookAuthors.url),
        eq(schema.authors.id, schema.bookAuthors.authorId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        inArray(schema.bookAuthors.bookId, bookIds),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));
}

async function getNarratorsForMedia(session: Session, mediaIds: string[]) {
  if (mediaIds.length === 0) return [];

  return db
    .select({
      mediaId: schema.mediaNarrators.mediaId,
      name: schema.narrators.name,
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}
