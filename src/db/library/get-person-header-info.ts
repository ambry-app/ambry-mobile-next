import { db } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

export type PersonHeaderInfo = Awaited<ReturnType<typeof getPersonHeaderInfo>>;

export async function getPersonHeaderInfo(session: Session, personId: string) {
  const person = await db.query.people.findFirst({
    columns: {
      id: true,
      name: true,
      thumbnails: true,
      description: true,
    },
    where: and(
      eq(schema.people.url, session.url),
      eq(schema.people.id, personId),
    ),
    with: {
      authors: {
        columns: { id: true, name: true },
        orderBy: schema.authors.name,
      },
      narrators: {
        columns: { id: true, name: true },
        orderBy: schema.narrators.name,
      },
    },
  });

  return requireValue(person, "Person not found");
}
