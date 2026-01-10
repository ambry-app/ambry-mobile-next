import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { Session } from "@/types/session";
import { requireValue } from "@/utils/require-value";

export type NarratorHeaderInfo = Awaited<
  ReturnType<typeof getNarratorHeaderInfo>
>;

export async function getNarratorHeaderInfo(
  session: Session,
  narratorId: string,
) {
  const narrator = await getDb().query.narrators.findFirst({
    columns: {
      id: true,
      name: true,
    },
    where: and(
      eq(schema.narrators.url, session.url),
      eq(schema.narrators.id, narratorId),
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

  return requireValue(narrator, "Narrator not found");
}
