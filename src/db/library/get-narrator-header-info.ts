import { getDb } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { Session } from "@/src/stores/session";
import { requireValue } from "@/src/utils";
import { and, eq } from "drizzle-orm";

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
