import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import useFadeInQuery from "@/src/hooks/use-fade-in-query";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, desc, eq } from "drizzle-orm";

export type ListedDownload = ReturnType<
  typeof useDownloadsList
>["downloads"][0];

// FIXME: remove this function, whatever uses it should use the zustand store instead
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

/**
 * Retrieves all download records associated with the given session.
 *
 * @param session - The current user session containing the URL context.
 * @returns A promise that resolves to an array of download records, ordered by download date in descending order.
 */
export async function getAllDownloads(session: Session) {
  return db.query.downloads.findMany({
    where: eq(schema.downloads.url, session.url),
    orderBy: desc(schema.downloads.downloadedAt),
  });
}

/**
 * Retrieves a single download record from the database that matches the given session URL and media ID.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media to find in the downloads.
 * @returns A promise that resolves to the download record if found, or `undefined` if no matching record exists.
 */
export async function getDownload(session: Session, mediaId: string) {
  return db.query.downloads.findFirst({
    where: and(
      eq(schema.downloads.url, session.url),
      eq(schema.downloads.mediaId, mediaId),
    ),
  });
}

/**
 * Creates a new download record in the database for the specified media item.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media to be downloaded.
 * @param filePath - The local file system path where the media will be stored.
 * @returns A promise that resolves to the created download record.
 * @throws If the download record cannot be retrieved after creation.
 */
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

  return requireValue(
    await getDownload(session, mediaId),
    "Download not found after creation",
  );
}

/**
 * Updates the attributes of a download record in the database for a given session and media ID.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media to update.
 * @param attributes - An object containing the attributes to update:
 *   - filePath (optional): The new file path of the downloaded media.
 *   - thumbnails (optional): The new thumbnails associated with the download, or null.
 *   - status (optional): The new status of the download, either "error" or "ready".
 * @returns The updated download record.
 * @throws If the download is not found after the update.
 */
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

  return requireValue(
    await getDownload(session, mediaId),
    "Download not found after update",
  );
}

/**
 * Deletes a download entry from the database for the specified media ID and session.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media to be deleted from downloads.
 * @returns A promise that resolves when the deletion is complete.
 */
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
