import { eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import type { Session } from "@/stores/session";

export async function getServerSyncTimestamps(session: Session) {
  const result = await getDb()
    .select({
      lastDownSync: schema.syncedServers.lastDownSync,
      newDataAsOf: schema.syncedServers.newDataAsOf,
    })
    .from(schema.syncedServers)
    .where(eq(schema.syncedServers.url, session.url))
    .limit(1);

  return result[0] || { lastDownSync: null, newDataAsOf: null };
}
