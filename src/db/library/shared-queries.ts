import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { PlaythroughStatus } from "@/db/schema";
import { Session } from "@/types/session";
import { groupMapBy } from "@/utils/group-map-by";

export async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return {};

  const authors = await getDb()
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
      personId: schema.people.id,
      personName: schema.people.name,
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
        inArray(schema.bookAuthors.bookId, bookIds),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));

  return groupMapBy(
    authors,
    (author) => author.bookId,
    ({ bookId: _bookId, ...author }) => author,
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
    ({ bookId: _bookId, ...media }) => media,
  );
}

export async function getNarratorsForMedia(
  session: Session,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) return {};

  const narrators = await getDb()
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
      personId: schema.people.id,
      personName: schema.people.name,
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
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));

  return groupMapBy(
    narrators,
    (narrator) => narrator.mediaId,
    ({ mediaId: _mediaId, ...narrator }) => narrator,
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

/**
 * Get saved-for-later status for multiple media items.
 * Returns a set of media IDs that are on the user's "saved" shelf.
 */
export async function getSavedForLaterStatusForMedia(
  session: Session,
  mediaIds: string[],
): Promise<Set<string>> {
  if (mediaIds.length === 0) return new Set();

  const savedMedia = await getDb()
    .select({
      mediaId: schema.shelvedMedia.mediaId,
    })
    .from(schema.shelvedMedia)
    .where(
      and(
        eq(schema.shelvedMedia.url, session.url),
        eq(schema.shelvedMedia.userEmail, session.email),
        eq(schema.shelvedMedia.shelfName, "saved"),
        inArray(schema.shelvedMedia.mediaId, mediaIds),
        isNull(schema.shelvedMedia.deletedAt),
      ),
    );

  return new Set(savedMedia.map((m) => m.mediaId));
}

/**
 * Get playthrough statuses for multiple media items.
 * Returns the most recent non-deleted playthrough status for each media.
 * Priority: in_progress > finished > abandoned (by recency within each status)
 */
export async function getPlaythroughStatusesForMedia(
  session: Session,
  mediaIds: string[],
): Promise<Record<string, PlaythroughStatus>> {
  if (mediaIds.length === 0) return {};

  // Get the most recent playthrough for each media
  // Order by: in_progress first, then by most recent activity
  const playthroughs = await getDb()
    .select({
      mediaId: schema.playthroughs.mediaId,
      status: schema.playthroughs.status,
      lastEventAt: schema.playthroughStateCache.lastEventAt,
    })
    .from(schema.playthroughs)
    .leftJoin(
      schema.playthroughStateCache,
      eq(schema.playthroughStateCache.playthroughId, schema.playthroughs.id),
    )
    .where(
      and(
        eq(schema.playthroughs.url, session.url),
        eq(schema.playthroughs.userEmail, session.email),
        inArray(schema.playthroughs.mediaId, mediaIds),
        isNull(schema.playthroughs.deletedAt),
      ),
    )
    .orderBy(
      // Prioritize in_progress, then order by most recent activity
      desc(
        sql`CASE WHEN ${schema.playthroughs.status} = 'in_progress' THEN 1 ELSE 0 END`,
      ),
      desc(schema.playthroughStateCache.lastEventAt),
    );

  // Group by mediaId and take the first (highest priority) status for each
  const statusMap: Record<string, PlaythroughStatus> = {};
  for (const p of playthroughs) {
    if (!statusMap[p.mediaId]) {
      statusMap[p.mediaId] = p.status;
    }
  }

  return statusMap;
}
