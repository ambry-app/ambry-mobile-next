import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, eq } from "drizzle-orm";
import { MediaHeaderInfo } from "./get-media-header-info";

export type MediaAuthorOrNarrator = {
  id: string;
  type: "author" | "narrator" | "authorAndNarrator";
  names: string[];
  realName: string;
  thumbnails: schema.Thumbnails | null;
};

export async function getMediaAuthorsAndNarrators(
  session: Session,
  media: MediaHeaderInfo,
) {
  const authors = await getAuthors(session, media.book.id);
  const narrators = await getNarrators(session, media.id);

  const collapsedMap = new Map<string, MediaAuthorOrNarrator>();

  for (const entry of [...authors, ...narrators]) {
    const personId = entry.person.id;
    let rec = collapsedMap.get(personId);

    if (!rec) {
      rec = {
        id: personId,
        type: entry.type,
        names: [entry.name],
        realName: entry.person.name,
        thumbnails: entry.person.thumbnails,
      };

      collapsedMap.set(personId, rec);
    } else {
      if (!rec.names.includes(entry.name)) rec.names.push(entry.name);
      if (rec.type !== entry.type) rec.type = "authorAndNarrator";
    }
  }

  return [...collapsedMap.values()];
}

async function getAuthors(session: Session, bookId: string) {
  const rows = await db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      personId: schema.authors.personId,
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
  const rows = await db
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
