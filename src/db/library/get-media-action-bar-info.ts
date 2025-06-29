import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, eq } from "drizzle-orm";

export type MediaActionBarInfo = Awaited<
  ReturnType<typeof getMediaActionBarInfo>
>;

/**
 * Retrieves action bar information for a specific media item associated with the current session.
 *
 * @param session - The current user session containing the URL context.
 * @param mediaId - The unique identifier of the media item to retrieve information for.
 * @returns A promise that resolves to the media information object, including id, thumbnails, and mp4Path.
 * @throws If the media item is not found, an error is thrown with the message "Media not found".
 */
export async function getMediaActionBarInfo(session: Session, mediaId: string) {
  const rows = await db
    .select({
      id: schema.media.id,
      thumbnails: schema.media.thumbnails,
      mp4Path: schema.media.mp4Path,
    })
    .from(schema.media)
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  return requireValue(rows[0], "Media not found");
}
