import { desc } from "drizzle-orm";

import { getDb } from "./db";
import { serverProfiles } from "./schema";

export async function getLatestProfile() {
  const db = getDb();
  return db.query.serverProfiles.findFirst({
    orderBy: [desc(serverProfiles.lastSyncTime)],
  });
}
