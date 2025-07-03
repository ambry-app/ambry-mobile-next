import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

export type BookOtherEditions = Awaited<
  ReturnType<typeof getBookOtherEditions>
>;

export async function getBookOtherEditions(session: Session, mediaId: string) {
  const book = await getBook(session, mediaId);
  const media = await getMedia(session, book.id, mediaId);

  if (media.length === 0) return null;

  const authors = await getAuthors(session, book.id);

  const mediaIds = media.map((m) => m.id);
  const narrators = await getNarrators(session, mediaIds);

  const narratorsByMediaId = Object.groupBy(
    narrators,
    (narrator) => narrator.mediaId,
  );

  return {
    ...book,
    authors,
    media: media.map((media) => ({
      ...media,
      narrators: (narratorsByMediaId[media.id] ?? []).map(
        ({ mediaId, ...narrator }) => narrator,
      ),
    })),
  };
}

async function getBook(session: Session, mediaId: string) {
  const rows = await db
    .select({
      id: schema.books.id,
      title: schema.books.title,
    })
    .from(schema.media)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Book not found");
}

async function getMedia(
  session: Session,
  bookId: string,
  withoutMediaId: string,
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
      and(
        eq(schema.media.url, session.url),
        eq(schema.media.bookId, bookId),
        ne(schema.media.id, withoutMediaId),
      ),
    )
    .orderBy(desc(schema.media.published))
    .limit(10);
}

async function getAuthors(session: Session, bookId: string) {
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

async function getNarrators(session: Session, mediaIds: string[]) {
  return db
    .select({
      name: schema.narrators.name,
      mediaId: schema.mediaNarrators.mediaId,
    })
    .from(schema.narrators)
    .innerJoin(
      schema.mediaNarrators,
      and(
        eq(schema.mediaNarrators.url, schema.narrators.url),
        eq(schema.mediaNarrators.narratorId, schema.narrators.id),
      ),
    )
    .where(
      and(
        eq(schema.narrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));
}
