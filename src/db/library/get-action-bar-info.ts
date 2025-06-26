import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils/require-value";
import { and, eq } from "drizzle-orm";

export type ActionBarInfo = Awaited<ReturnType<typeof getActionBarInfo>>;

export async function getActionBarInfo(session: Session, mediaId: string) {
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
