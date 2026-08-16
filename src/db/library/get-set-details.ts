import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

import { combineAuthorsAndNarrators } from "./shared-queries";

export type SetDetails = Awaited<ReturnType<typeof getSetDetails>>;

/**
 * A set is several recordings that together cover one book, released as
 * separate parts. It goes by its book, and carries its own name only where
 * the operator has said readers should see it — most set names mean something
 * to whoever filed them and nothing to a reader.
 */
export async function getSetDetails(session: Session, setId: string) {
  const set = await getSet(session, setId);
  const authors = await getSetAuthors(session, set.book.id);
  const narrators = await getSetNarrators(session, setId);

  return {
    ...set,
    authorsAndNarrators: combineAuthorsAndNarrators(authors, narrators),
  };
}

async function getSet(session: Session, setId: string) {
  const rows = await getDb()
    .select({
      id: schema.recordingGroups.id,
      name: schema.recordingGroups.name,
      showLabel: schema.recordingGroups.showLabel,
      partsTotal: schema.recordingGroups.partsTotal,
      partWord: schema.recordingGroups.partWord,
      partWordPlural: schema.recordingGroups.partWordPlural,
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.recordingGroups)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.recordingGroups.url),
        eq(schema.books.id, schema.recordingGroups.bookId),
      ),
    )
    .where(
      and(
        eq(schema.recordingGroups.url, session.url),
        eq(schema.recordingGroups.id, setId),
      ),
    )
    .limit(1);

  return requireValue(rows[0], `Set with id ${setId} not found`);
}

async function getSetAuthors(session: Session, bookId: string) {
  const rows = await getDb()
    .selectDistinct({
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
      schema.authorPeople,
      and(
        eq(schema.authorPeople.url, schema.authors.url),
        eq(schema.authorPeople.authorId, schema.authors.id),
      ),
    )
    .innerJoin(
      schema.people,
      and(
        eq(schema.people.url, schema.authorPeople.url),
        eq(schema.people.id, schema.authorPeople.personId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    )
    .orderBy(asc(schema.bookAuthors.position));

  return rows.map((row) => ({ ...row, type: "author" as const }));
}

async function getSetNarrators(session: Session, setId: string) {
  const rows = await getDb()
    .selectDistinct({
      id: schema.narrators.id,
      name: schema.narrators.name,
      person: {
        id: schema.people.id,
        name: schema.people.name,
        thumbnails: schema.people.thumbnails,
      },
    })
    .from(schema.media)
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.media.url),
        eq(schema.mediaNarrators.mediaId, schema.media.id),
      ),
    )
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
        eq(schema.media.url, session.url),
        eq(schema.media.recordingGroupId, setId),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.position));

  return rows.map((row) => ({ ...row, type: "narrator" as const }));
}
