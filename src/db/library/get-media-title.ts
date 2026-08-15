import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { recordingTitle } from "@/utils/titles";

export async function getMediaTitle(
  session: Session,
  mediaId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({
      title: schema.media.title,
      bookTitle: schema.books.title,
    })
    .from(schema.media)
    .innerJoin(
      schema.books,
      and(
        eq(schema.books.url, schema.media.url),
        eq(schema.books.id, schema.media.bookId),
      ),
    )
    .where(and(eq(schema.media.url, session.url), eq(schema.media.id, mediaId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return recordingTitle(row.title, row.bookTitle);
}
