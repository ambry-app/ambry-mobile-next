import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

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

  return rows[0] ?? null;
}
