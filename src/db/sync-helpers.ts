import { eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import type { Session } from "@/stores/session";

export async function getServerSyncTimestamps(session: Session) {
  const result = await getDb()
    .select({
      lastSyncTime: schema.syncedServers.lastSyncTime,
      libraryDataVersion: schema.syncedServers.libraryDataVersion,
    })
    .from(schema.syncedServers)
    .where(eq(schema.syncedServers.url, session.url))
    .limit(1);

  return result[0] || { lastSyncTime: null, libraryDataVersion: null };
}
