import { eq, sql } from "drizzle-orm";

import {
  DEFAULT_PREFERRED_PLAYBACK_RATE,
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
} from "@/constants";
import { getDb } from "@/db/db";
import * as schema from "@/db/schema";

export async function setPreferredPlaybackRate(
  userEmail: string,
  rate: number,
) {
  await getDb()
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

export async function getPreferredPlaybackRate(
  userEmail: string,
): Promise<number> {
  const response = await getDb().query.localUserSettings.findFirst({
    columns: {
      preferredPlaybackRate: true,
    },
    where: eq(schema.localUserSettings.userEmail, userEmail),
  });

  return response?.preferredPlaybackRate ?? DEFAULT_PREFERRED_PLAYBACK_RATE;
}

export async function setSleepTimerEnabled(
  userEmail: string,
  enabled: boolean,
) {
  await getDb()
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

export async function setSleepTimerTime(userEmail: string, seconds: number) {
  await getDb()
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

export async function getSleepTimerSettings(userEmail: string) {
  const response = await getDb().query.localUserSettings.findFirst({
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
      sleepTimer: DEFAULT_SLEEP_TIMER_SECONDS,
      sleepTimerEnabled: DEFAULT_SLEEP_TIMER_ENABLED,
    };
  }
}
