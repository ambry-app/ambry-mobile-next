import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

import { MediaHeaderInfo } from "./get-media-header-info";
import { combineAuthorsAndNarrators } from "./shared-queries";

export async function getMediaAuthorsAndNarrators(
  session: Session,
  media: MediaHeaderInfo,
) {
  const authors = await getAuthors(session, media.book.id);
  const narrators = await getNarrators(session, media.id);

  return combineAuthorsAndNarrators(authors, narrators);
}

async function getAuthors(session: Session, bookId: string) {
  const rows = await getDb()
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
        thumbnails: schema.people.thumbnails,
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

  return rows.map((row) => ({
    ...row,
    type: "author" as const,
  }));
}

async function getNarrators(session: Session, mediaId: string) {
  const rows = await getDb()
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
        thumbnails: schema.people.thumbnails,
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

  return rows.map((row) => ({
    ...row,
    type: "narrator" as const,
  }));
}
