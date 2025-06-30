import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, desc, eq, inArray } from "drizzle-orm";

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
  const bookAuthors = await getBookAuthors(session, media.bookId);
  const authorIds = bookAuthors.map((ba) => ba.authorId);
  const authors = await getAuthors(session, authorIds);

  const mediaNarrators = await getMediaNarrators(session, mediaId);
  const narratorIds = mediaNarrators.map((mn) => mn.narratorId);
  const narrators = await getNarrators(session, narratorIds);

  const authorPersonIds = new Set(authors.map((a) => a.personId));
  const narratorPersonIds = new Set(narrators.map((n) => n.personId));
  const personIds = [...new Set([...authorPersonIds, ...narratorPersonIds])];
  const people = await getPeople(session, personIds);

  const authorsMap = Object.fromEntries(authors.map((a) => [a.id, a]));
  const narratorsMap = Object.fromEntries(narrators.map((n) => [n.id, n]));
  const peopleMap = Object.fromEntries(people.map((p) => [p.id, p]));

  const orderedAuthors = bookAuthors.map((ba) => {
    const author = requireValue(authorsMap[ba.authorId], "Author not found");
    const person = requireValue(peopleMap[author.personId], "Person not found");

    return {
      type: "author" as const,
      name: author.name,
      person: person,
    };
  });

  const orderedNarrators = mediaNarrators.map((mn) => {
    const narrator = requireValue(
      narratorsMap[mn.narratorId],
      "Narrator not found",
    );
    const person = requireValue(
      peopleMap[narrator.personId],
      "Person not found",
    );
    return {
      type: "narrator" as const,
      name: narrator.name,
      person: person,
    };
  });

  const collapsedMap = new Map<string, MediaAuthorOrNarrator>();

  for (const entry of [...orderedAuthors, ...orderedNarrators]) {
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

// --- Private helpers ---

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

async function getBookAuthors(session: Session, bookId: string) {
  return db
    .select({
      id: schema.bookAuthors.id,
      authorId: schema.bookAuthors.authorId,
    })
    .from(schema.bookAuthors)
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    )
    .orderBy(desc(schema.bookAuthors.insertedAt));
}

async function getAuthors(session: Session, authorIds: string[]) {
  if (!authorIds.length) return [];

  return db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      personId: schema.authors.personId,
    })
    .from(schema.authors)
    .where(
      and(
        eq(schema.authors.url, session.url),
        inArray(schema.authors.id, authorIds),
      ),
    );
}

async function getMediaNarrators(session: Session, mediaId: string) {
  return db
    .select({
      id: schema.mediaNarrators.id,
      narratorId: schema.mediaNarrators.narratorId,
    })
    .from(schema.mediaNarrators)
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        eq(schema.mediaNarrators.mediaId, mediaId),
      ),
    )
    .orderBy(desc(schema.mediaNarrators.insertedAt));
}

async function getNarrators(session: Session, narratorIds: string[]) {
  if (!narratorIds.length) return [];

  return db
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
      personId: schema.narrators.personId,
    })
    .from(schema.narrators)
    .where(
      and(
        eq(schema.narrators.url, session.url),
        inArray(schema.narrators.id, narratorIds),
      ),
    );
}

async function getPeople(session: Session, personIds: string[]) {
  if (!personIds.length) return [];

  return db
    .select({
      id: schema.people.id,
      name: schema.people.name,
      thumbnails: schema.people.thumbnails,
    })
    .from(schema.people)
    .where(
      and(
        eq(schema.people.url, session.url),
        inArray(schema.people.id, personIds),
      ),
    );
}
