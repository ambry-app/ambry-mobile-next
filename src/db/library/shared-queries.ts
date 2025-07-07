import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { groupMapBy } from "@/src/utils";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

export async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return {};

  const authors = await db
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

  const media = await db
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

  const narrators = await db
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
