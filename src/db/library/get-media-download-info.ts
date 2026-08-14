import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

export type MediaDownloadInfo = NonNullable<
  Awaited<ReturnType<typeof getMediaDownloadInfo>>
>;

/**
 * What a download needs to fetch a recording: its direct-play files if it has
 * them, and the legacy packaged file if it does not.
 */
export async function getMediaDownloadInfo(session: Session, mediaId: string) {
  const rows = await getDb()
    .select({
      mp4Path: schema.media.mp4Path,
      thumbnails: schema.media.thumbnails,
    })
    .from(schema.media)
    .where(
      and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)),
    );

  const media = rows[0];
  if (!media) return null;

  const tracks = await getDb()
    .select({
      id: schema.mediaTracks.id,
      index: schema.mediaTracks.index,
      path: schema.mediaTracks.path,
      size: schema.mediaTracks.size,
    })
    .from(schema.mediaTracks)
    .where(
      and(
        eq(schema.mediaTracks.url, session.url),
        eq(schema.mediaTracks.mediaId, mediaId),
      ),
    )
    .orderBy(asc(schema.mediaTracks.index));

  return { ...media, tracks };
}
