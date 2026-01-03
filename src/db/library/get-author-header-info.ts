import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils";

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
      person: {
        columns: {
          id: true,
          name: true,
          thumbnails: true,
        },
      },
    },
  });

  return requireValue(author, "Author not found");
}
