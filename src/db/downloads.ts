import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import useFadeInQuery from "@/src/hooks/use.fade.in.query";
import { Session } from "@/src/stores/session";
import { and, desc, eq } from "drizzle-orm";

export type MediaNarrator = {
  id: string;
  narrator: {
    id: string;
    name: string;
  };
};

export type Author = {
  id: string;
  name: string;
};

export type BookAuthor = {
  id: string;
  author: Author;
};

export type Book = {
  id: string;
  title: string;
  bookAuthors: BookAuthor[];
};

export type Media = {
  id: string;
  thumbnails: schema.Thumbnails | null;
  mediaNarrators: MediaNarrator[];
  book: Book;
};

export type Download = {
  filePath: string;
  status: "pending" | "ready" | "error";
  thumbnails: schema.DownloadedThumbnails | null;
  media: Media;
};

export function useDownloadsList(session: Session) {
  const query = db.query.downloads.findMany({
    columns: { status: true, thumbnails: true, filePath: true },
    where: eq(schema.downloads.url, session.url),
    orderBy: desc(schema.downloads.downloadedAt),
    with: {
      media: {
        columns: { id: true, thumbnails: true },
        with: {
          mediaNarrators: {
            columns: { id: true },
            with: {
              narrator: {
                columns: { id: true, name: true },
              },
            },
          },
          book: {
            columns: { id: true, title: true },
            with: {
              bookAuthors: {
                columns: { id: true },
                with: {
                  author: {
                    columns: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return useFadeInQuery(query, [
    "downloads",
    "media",
    "media_narrators",
    "narrators",
    "books",
    "book_authors",
    "authors",
  ]);
}

export async function getDownload(
  session: Session,
  mediaId: string,
): Promise<schema.Download | undefined> {
  return db.query.downloads.findFirst({
    where: and(
      eq(schema.downloads.url, session.url),
      eq(schema.downloads.mediaId, mediaId),
    ),
  });
}

export async function createDownload(
  session: Session,
  mediaId: string,
  filePath: string,
): Promise<void> {
  const now = new Date();

  await db.insert(schema.downloads).values({
    url: session.url,
    mediaId: mediaId,
    downloadedAt: now,
    status: "pending",
    filePath,
  });
}

export async function updateDownload(
  session: Session,
  mediaId: string,
  attributes: {
    filePath?: string;
    thumbnails?: schema.DownloadedThumbnails | null;
    status?: "error" | "ready";
  },
): Promise<void> {
  await db
    .update(schema.downloads)
    .set({
      ...attributes,
    })
    .where(
      and(
        eq(schema.downloads.url, session.url),
        eq(schema.downloads.mediaId, mediaId),
      ),
    );
}

export async function deleteDownload(
  session: Session,
  mediaId: string,
): Promise<void> {
  await db
    .delete(schema.downloads)
    .where(
      and(
        eq(schema.downloads.url, session.url),
        eq(schema.downloads.mediaId, mediaId),
      ),
    );
}
