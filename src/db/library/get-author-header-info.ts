import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

export type AuthorHeaderInfo = Awaited<ReturnType<typeof getAuthorHeaderInfo>>;

export async function getAuthorHeaderInfo(session: Session, authorId: string) {
  const author = await getDb().query.authors.findFirst({
    columns: {
      id: true,
      name: true,
    },
    where: and(
      eq(schema.authors.url, session.url),
      eq(schema.authors.id, authorId),
    ),
    with: {
      authorPeople: {
        columns: {},
        with: {
          person: {
            columns: {
              id: true,
              name: true,
              thumbnails: true,
            },
          },
        },
      },
    },
  });

  const found = requireValue(author, "Author not found");

  // A byline can be one person writing under a pen name, or several people
  // sharing one ("James S.A. Corey"). Callers get the list and decide.
  return {
    id: found.id,
    name: found.name,
    people: found.authorPeople.map((authorPerson) => authorPerson.person),
  };
}
