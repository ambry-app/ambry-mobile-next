import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { flatMapGroups } from "@/src/utils";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  getAuthorsForBooks,
  getMediaForBooks,
  getNarratorsForMedia,
} from "./shared-queries";

export async function getBooksByAuthorPage(
  session: Session,
  authorId: string,
  limit: number,
  publishedBefore?: Date,
) {
  const books = await getBooks(session, authorId, limit, publishedBefore);

  const bookIds = books.map((b) => b.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);
  const mediaForBooks = await getMediaForBooks(session, bookIds);

  const mediaIds = flatMapGroups(mediaForBooks, (media) => media.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return books.map((book) => ({
    ...book,
    authors: authorsForBooks[book.id] ?? [],
    media: (mediaForBooks[book.id] ?? []).map((media) => ({
      ...media,
      narrators: narratorsForMedia[media.id] ?? [],
    })),
  }));
}

async function getBooks(
  session: Session,
  authorId: string,
  limit: number,
  publishedBefore?: Date,
) {
  return getDb()
    .select({
      id: schema.books.id,
      title: schema.books.title,
      published: schema.books.published,
    })
    .from(schema.bookAuthors)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.bookAuthors.url),
        eq(schema.books.id, schema.bookAuthors.bookId),
      ),
    )
    .where(
      and(
        eq(schema.bookAuthors.url, session.url),
        eq(schema.bookAuthors.authorId, authorId),
        publishedBefore
          ? lt(schema.books.published, publishedBefore)
          : undefined,
      ),
    )
    .orderBy(desc(schema.books.published))
    .limit(limit);
}
