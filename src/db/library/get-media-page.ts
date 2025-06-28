import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

/**
 * Fetches a paginated list of media items along with their related books, authors, and narrators.
 *
 * This function performs the following steps:
 * 1. Retrieves recent media items with optional pagination based on insertion date.
 * 2. Fetches related books for the media items in batch.
 * 3. Fetches book-author relationships and corresponding author details in batch.
 * 4. Fetches media-narrator relationships and corresponding narrator details in batch.
 * 5. Assembles and returns an array where each media item includes its book (with authors) and narrators.
 *
 * @param session - The current user session containing the URL context.
 * @param limit - The maximum number of media items to fetch.
 * @param insertedBefore - (Optional) Only include media inserted before this date.
 * @returns A promise that resolves to an array of media items, each with its related book (including authors) and narrators.
 */
export async function getMediaPage(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  // 1. Fetch paginated media
  const media = await recentMedia(session, limit, insertedBefore);

  // 2. Fetch related books in batch
  const bookIds = [...new Set(media.map((m) => m.bookId))];
  const books = await booksByIds(session, bookIds);

  // 3. Fetch bookAuthors in batch
  const bookAuthors = await bookAuthorsByBookIds(session, bookIds);

  // 4. Fetch authors in batch
  const authorIds = [...new Set(bookAuthors.map((ba) => ba.authorId))];
  const authors = await authorsByIds(session, authorIds);

  // 5. Fetch media narrators in batch (existing)
  const mediaIds = media.map((m) => m.id);
  const mediaNarrators = await mediaNarratorsByMediaIds(session, mediaIds);

  // 6. Fetch narrator details in batch (existing)
  const narratorIds = [...new Set(mediaNarrators.map((n) => n.narratorId))];
  const narrators = await narratorsByIds(session, narratorIds);

  // --- Assemble everything ---

  // Map books, authors, and narrators by id for fast lookup
  const bookMap = Object.fromEntries(books.map((b) => [b.id, b]));
  const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));
  const narratorMap = Object.fromEntries(narrators.map((n) => [n.id, n]));

  // Group bookAuthors by bookId
  const authorsByBookId = bookAuthors.reduce<Record<string, typeof authors>>(
    (acc, ba) => {
      const author = authorMap[ba.authorId];
      if (author) {
        acc[ba.bookId] = [...(acc[ba.bookId] ?? []), author];
      }
      return acc;
    },
    {},
  );

  // Group narrators by mediaId
  const narratorsByMediaId = mediaNarrators.reduce<
    Record<string, typeof narrators>
  >((acc, mn) => {
    const narrator = narratorMap[mn.narratorId];
    if (narrator) {
      acc[mn.mediaId] = [...(acc[mn.mediaId] ?? []), narrator];
    }
    return acc;
  }, {});

  // Final assembled array for your FlatList
  return media.map((media) => ({
    ...media,
    book: {
      ...requireValue(bookMap[media.bookId], "Book not found"),
      authors: authorsByBookId[media.bookId] || [],
    },
    narrators: narratorsByMediaId[media.id] || [],
  }));
}

async function recentMedia(
  session: Session,
  limit: number,
  insertedBefore?: Date,
) {
  return db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      insertedAt: schema.media.insertedAt,
      bookId: schema.media.bookId,
    })
    .from(schema.media)
    .where(
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.status, "ready"),
        insertedBefore
          ? lt(schema.media.insertedAt, insertedBefore)
          : undefined,
      ),
    )
    .orderBy(desc(schema.media.insertedAt))
    .limit(limit);
}

async function booksByIds(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: schema.books.id,
      title: schema.books.title,
    })
    .from(schema.books)
    .where(
      and(eq(schema.books.url, session.url), inArray(schema.books.id, bookIds)),
    );
}

async function bookAuthorsByBookIds(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) {
    return [];
  }

  return db
    .select({
      bookId: schema.bookAuthors.bookId,
      authorId: schema.bookAuthors.authorId,
    })
    .from(schema.bookAuthors)
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        inArray(schema.bookAuthors.bookId, bookIds),
      ),
    );
}

async function authorsByIds(session: Session, authorIds: string[]) {
  if (authorIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
    })
    .from(schema.authors)
    .where(
      and(
        eq(schema.authors.url, session.url),
        inArray(schema.authors.id, authorIds),
      ),
    );
}

async function mediaNarratorsByMediaIds(session: Session, mediaIds: string[]) {
  if (mediaIds.length === 0) {
    return [];
  }

  return db
    .select({
      mediaId: schema.mediaNarrators.mediaId,
      narratorId: schema.mediaNarrators.narratorId,
    })
    .from(schema.mediaNarrators)
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    );
}

async function narratorsByIds(session: Session, narratorIds: string[]) {
  if (narratorIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: schema.narrators.id,
      name: schema.narrators.name,
    })
    .from(schema.narrators)
    .where(
      and(
        eq(schema.narrators.url, session.url),
        inArray(schema.narrators.id, narratorIds),
      ),
    );
}
