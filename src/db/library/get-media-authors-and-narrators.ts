import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, asc, eq } from "drizzle-orm";

export type MediaAuthorOrNarrator = {
  id: string;
  type: "author" | "narrator" | "authorAndNarrator";
  names: string[];
  realName: string;
  thumbnails: schema.Thumbnails | null;
};

/**
 * Retrieves and combines the authors and narrators associated with a given media item.
 *
 * This function fetches the authors of the book linked to the media, as well as the narrators
 * specific to the media. It then gathers the corresponding person records for both authors and narrators,
 * and returns a deduplicated, collapsed list of people, indicating their roles (author, narrator, or both),
 * their display names, real names, and thumbnails.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The ID of the media item for which to retrieve authors and narrators.
 * @returns A promise that resolves to an array of objects representing authors, narrators, or both,
 *          each containing the person's ID, role type, associated names, real name, and thumbnails.
 * @throws If any referenced author, narrator, or person cannot be found.
 */
export async function getMediaAuthorsAndNarrators(
  session: Session,
  mediaId: string,
) {
  const media = await getMedia(session, mediaId);

  const authors = await getAuthors(session, media.bookId);
  const narrators = await getNarrators(session, mediaId);

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

async function getMedia(session: Session, mediaId: string) {
  const rows = await db
    .select({
      id: schema.media.id,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Media not found");
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
    .from(schema.authors)
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.authors.url),
        eq(schema.bookAuthors.authorId, schema.authors.id),
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
        eq(schema.authors.url, session.url),
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
    .from(schema.narrators)
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.narrators.url),
        eq(schema.mediaNarrators.narratorId, schema.narrators.id),
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
        eq(schema.narrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));

  return rows.map((row) => ({
    ...row,
    type: "narrator" as const,
  }));
}
