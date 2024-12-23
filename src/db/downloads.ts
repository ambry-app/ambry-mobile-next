import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import useFadeInQuery from "@/src/hooks/use.fade.in.query";
import { Session } from "@/src/stores/session";
import { and, desc, eq } from "drizzle-orm";

export type ListedDownload = ReturnType<
  typeof useDownloadsList
>["downloads"][0];

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

  const { data, ...rest } = useFadeInQuery(query);

  return { downloads: data, ...rest };
}

export type Download = ReturnType<typeof useDownload>["download"];

export function useDownload(session: Session, mediaId: string) {
  const query = db.query.downloads.findFirst({
    where: and(
      eq(schema.downloads.url, session.url),
      eq(schema.downloads.mediaId, mediaId),
    ),
  });

  const { data: download, ...rest } = useFadeInQuery(query);

  return { download, ...rest };
}

export async function getDownload(session: Session, mediaId: string) {
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
) {
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
) {
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

export async function deleteDownload(session: Session, mediaId: string) {
  console.debug("[Downloads] Deleting download from database", mediaId);
  await db
    .delete(schema.downloads)
    .where(
      and(
        eq(schema.downloads.url, session.url),
        eq(schema.downloads.mediaId, mediaId),
      ),
    );
}
