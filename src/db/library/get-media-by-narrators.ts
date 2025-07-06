import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getNarratorsForMedia } from "./shared-queries";

export type MediaByNarratorsType = Awaited<
  ReturnType<typeof getMediaByNarrators>
>;

type Narrator = {
  id: string;
  name: string;
};

export async function getMediaByNarrators(
  session: Session,
  narrators: Narrator[],
) {
  const narratorIds = narrators.map((n) => n.id);
  const media = await getMediaForNarrators(session, narratorIds);

  const bookIds = media.map((m) => m.book.id);
  const authors = await getAuthorsForBooks(session, bookIds);

  const mediaIds = media.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  const authorsByBookId = Object.groupBy(authors, (a) => a.bookId);
  const mediaByNarratorId = Object.groupBy(media, (m) => m.narratorId);

  return narrators.map((narrator) => ({
    ...narrator,
    media: (mediaByNarratorId[narrator.id] ?? []).map(
      ({ narratorId, ...media }) => ({
        ...media,
        book: {
          ...media.book,
          authors: (authorsByBookId[media.book.id] ?? []).map(
            ({ bookId, ...author }) => author,
          ),
        },
        narrators: (narratorsForMedia[media.id] ?? []).map(
          ({ mediaId, ...narrator }) => narrator,
        ),
      }),
    ),
  }));
}

async function getMediaForNarrators(session: Session, narratorIds: string[]) {
  if (narratorIds.length === 0) return [];

  const media = await db
    .select({
      id: schema.media.id,
      narratorId: schema.mediaNarrators.narratorId,
      thumbnails: schema.media.thumbnails,
      download: { thumbnails: schema.downloads.thumbnails },
      book: {
        id: schema.books.id,
        title: schema.books.title,
      },
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.media,
      and(
        eq(schema.media.url, schema.mediaNarrators.url),
        eq(schema.media.id, schema.mediaNarrators.mediaId),
      ),
    )
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .leftJoin(
      schema.downloads,
      and(
        eq(schema.downloads.url, schema.media.url),
        eq(schema.downloads.mediaId, schema.media.id),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.narratorId, narratorIds),
      ),
    )
    .orderBy(desc(schema.media.published));

  // Limit to 10 media per narratorId
  // Doing it in JS right now because it's too hard to do window functions with drizzle-orm
  const grouped = Object.groupBy(media, (m) => m.narratorId);
  return Object.values(grouped).flatMap((arr) => (arr ?? []).slice(0, 10));
}

async function getAuthorsForBooks(session: Session, bookIds: string[]) {
  if (bookIds.length === 0) return [];

  return db
    .select({
      bookId: schema.bookAuthors.bookId,
      name: schema.authors.name,
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
}
