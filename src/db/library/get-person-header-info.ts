import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

export type PersonHeaderInfo = Awaited<ReturnType<typeof getPersonHeaderInfo>>;

export async function getPersonHeaderInfo(session: Session, personId: string) {
  const rows = await db
    .select({
      thumbnails: schema.people.thumbnails,
      description: schema.people.description,
    })
    .from(schema.people)
    .where(
      and(eq(schema.people.url, session.url), eq(schema.people.id, personId)),
    )
    .limit(1);

  return requireValue(rows[0], "Person not found");
}
