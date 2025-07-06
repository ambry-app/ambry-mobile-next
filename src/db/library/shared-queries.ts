import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function getNarratorsForMedia(
  session: Session,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) return {};

  const narrators = await db
    .select({
      name: schema.narrators.name,
      mediaId: schema.mediaNarrators.mediaId,
    })
    .from(schema.mediaNarrators)
    .innerJoin(
      schema.narrators,
      and(
        eq(schema.narrators.url, schema.mediaNarrators.url),
        eq(schema.narrators.id, schema.mediaNarrators.narratorId),
      ),
    )
    .where(
      and(
        eq(schema.mediaNarrators.url, session.url),
        inArray(schema.mediaNarrators.mediaId, mediaIds),
      ),
    )
    .orderBy(asc(schema.mediaNarrators.insertedAt));

  return Object.groupBy(narrators, (narrator) => narrator.mediaId);
}
