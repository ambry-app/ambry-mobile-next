import { Database } from "@/src/db/db";
import * as schema from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";

export async function setPreferredPlaybackRate(
  db: Database,
  userEmail: string,
  rate: number,
) {
  await db
    .insert(schema.localUserSettings)
    .values({
      userEmail,
      preferredPlaybackRate: rate,
    })
    .onConflictDoUpdate({
      target: [schema.localUserSettings.userEmail],
      set: {
        preferredPlaybackRate: sql`excluded.preferred_playback_rate`,
      },
    });
}

export async function setSleepTimerEnabled(
  db: Database,
  userEmail: string,
  enabled: boolean,
) {
  await db
    .insert(schema.localUserSettings)
    .values({
      userEmail,
      sleepTimerEnabled: enabled,
    })
    .onConflictDoUpdate({
      target: [schema.localUserSettings.userEmail],
      set: {
        sleepTimerEnabled: sql`excluded.sleep_timer_enabled`,
      },
    });
}

export async function setSleepTimerTime(
  db: Database,
  userEmail: string,
  seconds: number,
) {
  await db
    .insert(schema.localUserSettings)
    .values({
      userEmail,
      sleepTimer: seconds,
    })
    .onConflictDoUpdate({
      target: [schema.localUserSettings.userEmail],
      set: {
        sleepTimer: sql`excluded.sleep_timer`,
      },
    });
}

export async function getSleepTimerSettings(db: Database, userEmail: string) {
  const response = await db.query.localUserSettings.findFirst({
    columns: {
      sleepTimer: true,
      sleepTimerEnabled: true,
    },
    where: eq(schema.localUserSettings.userEmail, userEmail),
  });

  if (response) {
    return response;
  } else {
    return {
      sleepTimer: schema.defaultSleepTimer,
      sleepTimerEnabled: schema.defaultSleepTimerEnabled,
    };
  }
}
