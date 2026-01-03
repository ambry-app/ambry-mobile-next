import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";

export async function getMediaTitle(
  session: Session,
  mediaId: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({
      title: schema.books.title,
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

  return rows[0]?.title ?? null;
}
