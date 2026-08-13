import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

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
      authorPeople: {
        columns: {},
        with: {
          author: { columns: { id: true, name: true } },
        },
      },
      narrators: {
        columns: { id: true, name: true },
        orderBy: schema.narrators.name,
      },
    },
  });

  const found = requireValue(person, "Person not found");

  // A person can write under several bylines, so their authors come through
  // the join. Sorted here rather than in SQL because the name lives one level
  // down from the row being ordered.
  const authors = found.authorPeople
    .map((authorPerson) => authorPerson.author)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: found.id,
    name: found.name,
    thumbnails: found.thumbnails,
    description: found.description,
    authors,
    narrators: found.narrators,
  };
}
