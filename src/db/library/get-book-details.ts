import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq } from "drizzle-orm";
import { getNarratorsForMedia } from "./shared-queries";

export type BookDetails = Awaited<ReturnType<typeof getBookDetails>>;

export async function getBookDetails(
  session: Session,
  bookId: string,
  mediaLimit: number,
) {
  const book = await getBook(session, bookId);
  const authorsForBook = await getAuthorsForBook(session, bookId);
  const mediaForBook = await getMediaForBook(session, bookId, mediaLimit);

  const mediaIds = mediaForBook.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return {
    ...book,
    authors: authorsForBook,
    media: mediaForBook.map((media) => ({
      ...media,
      narrators: narratorsForMedia[media.id] ?? [],
    })),
  };
}

async function getBook(session: Session, bookId: string) {
  const book = await db.query.books.findFirst({
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
  return db
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

async function getMediaForBook(
  session: Session,
  bookId: string,
  limit: number,
) {
  return db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      download: {
        thumbnails: schema.downloads.thumbnails,
      },
    })
    .from(schema.media)
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(eq(schema.media.url, session.url), eq(schema.media.bookId, bookId)),
    )
    .orderBy(desc(schema.media.published))
    .limit(limit);
}
