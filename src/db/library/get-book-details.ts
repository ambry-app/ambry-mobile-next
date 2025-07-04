import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type BookDetails = Awaited<ReturnType<typeof getBookDetails>>;

export async function getBookDetails(session: Session, bookId: string) {
  const book = await getBook(session, bookId);
  const authors = await getAuthors(session, bookId);
  const media = await getMedia(session, bookId);

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

async function getMedia(session: Session, bookId: string) {
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
    .limit(10);
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
