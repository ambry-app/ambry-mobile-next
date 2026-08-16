import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { toEditions } from "@/utils/editions";
import { requireValue } from "@/utils/require-value";

import {
  getEditionMediaForBook,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
} from "./shared-queries";

export type BookDetails = Awaited<ReturnType<typeof getBookDetails>>;

/**
 * A book and its editions.
 *
 * The book screen is where editions are shown as themselves, so a set arrives
 * whole — one tile stacking its parts — rather than as loose recordings.
 */
export async function getBookDetails(
  session: Session,
  bookId: string,
  editionLimit: number,
) {
  const book = await getBook(session, bookId);
  const authorsForBook = await getAuthorsForBook(session, bookId);
  const mediaForBook = await getEditionMediaForBook(session, bookId);

  const mediaIds = mediaForBook.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );
  const savedForLater = await getSavedForLaterStatusForMedia(session, mediaIds);

  const media = mediaForBook.map((media) => ({
    ...media,
    narrators: narratorsForMedia[media.id] ?? [],
    playthroughStatus: playthroughStatuses[media.id] ?? null,
    isOnSavedShelf: savedForLater.has(media.id),
  }));

  return {
    ...book,
    authors: authorsForBook,
    editions: toEditions(media).slice(0, editionLimit),
  };
}

async function getBook(session: Session, bookId: string) {
  const book = await getDb().query.books.findFirst({
    columns: {
      id: true,
      title: true,
      published: true,
      publishedFormat: true,
    },
    where: and(eq(schema.books.url, session.url), eq(schema.books.id, bookId)),
  });

  return requireValue(book, "Book not found");
}

async function getAuthorsForBook(session: Session, bookId: string) {
  return getDb()
    .select({
      name: schema.authors.name,
    })
    .from(schema.authors)
    .innerJoin(
      schema.bookAuthors,
      and(
        eq(schema.bookAuthors.url, schema.authors.url),
        eq(schema.bookAuthors.authorId, schema.authors.id),
      ),
    )
    .where(
      and(
        eq(schema.authors.url, session.url),
        eq(schema.bookAuthors.bookId, bookId),
      ),
    )
    .orderBy(asc(schema.bookAuthors.insertedAt));
}
