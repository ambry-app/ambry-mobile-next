import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils";

export type PersonHeaderInfo = Awaited<ReturnType<typeof getPersonHeaderInfo>>;

export async function getPersonHeaderInfo(session: Session, personId: string) {
  const person = await getDb().query.people.findFirst({
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
