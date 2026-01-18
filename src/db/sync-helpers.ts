import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/db";
import * as schema from "@/db/schema";
import type { Session } from "@/types/session";

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

export async function getServerProfileSyncTimestamps(session: Session) {
  const result = await getDb()
    .select({
      lastSyncTime: schema.serverProfiles.lastSyncTime,
      lastFullPlaythroughSyncTime:
        schema.serverProfiles.lastFullPlaythroughSyncTime,
    })
    .from(schema.serverProfiles)
    .where(
      and(
        eq(schema.serverProfiles.url, session.url),
        eq(schema.serverProfiles.userEmail, session.email),
      ),
    )
    .limit(1);

  return result[0] || { lastSyncTime: null, lastFullPlaythroughSyncTime: null };
}

export async function setLastFullPlaythroughSyncTime(
  session: Session,
  time: Date,
) {
  return getDb()
    .update(schema.serverProfiles)
    .set({ lastFullPlaythroughSyncTime: time })
    .where(
      and(
        eq(schema.serverProfiles.url, session.url),
        eq(schema.serverProfiles.userEmail, session.email),
      ),
    );
}
