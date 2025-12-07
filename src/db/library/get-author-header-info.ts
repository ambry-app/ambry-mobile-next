import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

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
