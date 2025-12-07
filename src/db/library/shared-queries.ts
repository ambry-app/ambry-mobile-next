import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { groupMapBy } from "@/src/utils";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

export async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return {};

  const authors = await getDb()
    .select({
      name: schema.authors.name,
      bookId: schema.bookAuthors.bookId,
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

  return groupMapBy(
    authors,
    (author) => author.bookId,
    ({ bookId, ...author }) => author,
  );
}

export async function getMediaForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return {};

  const media = await getDb()
    .select({
      id: schema.media.id,
      bookId: schema.media.bookId,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
    })
    .from(schema.media)
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .where(
      and(
        eq(schema.media.url, session.url),
        inArray(schema.media.bookId, bookIds),
      ),
    )
    .orderBy(
      desc(sql`COALESCE(${schema.media.published}, ${schema.books.published})`),
    );

  return groupMapBy(
    media,
    (media) => media.bookId,
    ({ bookId, ...media }) => media,
  );
}

export async function getNarratorsForMedia(
  session: Session,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) return {};

  const narrators = await getDb()
    .select({
      name: schema.narrators.name,
      mediaId: schema.mediaNarrators.mediaId,
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

  return groupMapBy(
    narrators,
    (narrator) => narrator.mediaId,
    ({ mediaId, ...narrator }) => narrator,
  );
}

type AuthorForCombination = {
  type: "author";
  id: string;
  name: string;
  person: {
    id: string;
    name: string;
    thumbnails: schema.Thumbnails | null;
  };
};

type NarratorForCombination = {
  type: "narrator";
  id: string;
  name: string;
  person: {
    id: string;
    name: string;
    thumbnails: schema.Thumbnails | null;
  };
};

export type MediaAuthorOrNarrator = {
  id: string;
  type: "author" | "narrator" | "authorAndNarrator";
  names: string[];
  realName: string;
  thumbnails: schema.Thumbnails | null;
};

/**
 * Combine authors and narrators into a single list, collapsing by person ID.
 * People who appear as both author and narrator get type "authorAndNarrator".
 * Multiple pen names for the same person are collected in the `names` array.
 *
 * @example
 * combineAuthorsAndNarrators(
 *   [{ type: "author", person: { id: "p1" }, name: "Pen Name" }],
 *   [{ type: "narrator", person: { id: "p1" }, name: "Real Name" }]
 * )
 * // [{ id: "p1", type: "authorAndNarrator", names: ["Pen Name", "Real Name"], ... }]
 */
export function combineAuthorsAndNarrators(
  authors: AuthorForCombination[],
  narrators: NarratorForCombination[],
) {
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
