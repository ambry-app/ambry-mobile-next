import { sql } from "drizzle-orm";

import {
  DEFAULT_PREFERRED_PLAYBACK_RATE,
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
} from "@/constants";
import { getDb } from "@/db/db";
import * as schema from "@/db/schema";

// The local settings table holds a single device-scoped row
const SETTINGS_ROW_ID = "local";

export async function setPreferredPlaybackRate(rate: number) {
  await getDb()
    .insert(schema.localSettings)
    .values({
      id: SETTINGS_ROW_ID,
      preferredPlaybackRate: rate,
    })
    .onConflictDoUpdate({
      target: [schema.localSettings.id],
      set: {
        preferredPlaybackRate: sql`excluded.preferred_playback_rate`,
      },
    });
}

export async function getPreferredPlaybackRate(): Promise<number> {
  const response = await getDb().query.localSettings.findFirst({
    columns: {
      preferredPlaybackRate: true,
    },
  });

  return response?.preferredPlaybackRate ?? DEFAULT_PREFERRED_PLAYBACK_RATE;
}

export async function setSleepTimerEnabled(enabled: boolean) {
  await getDb()
    .insert(schema.localSettings)
    .values({
      id: SETTINGS_ROW_ID,
      sleepTimerEnabled: enabled,
    })
    .onConflictDoUpdate({
      target: [schema.localSettings.id],
      set: {
        sleepTimerEnabled: sql`excluded.sleep_timer_enabled`,
      },
    });
}

export async function setSleepTimerTime(seconds: number) {
  await getDb()
    .insert(schema.localSettings)
    .values({
      id: SETTINGS_ROW_ID,
      sleepTimer: seconds,
    })
    .onConflictDoUpdate({
      target: [schema.localSettings.id],
      set: {
        sleepTimer: sql`excluded.sleep_timer`,
      },
    });
}

export async function setSleepTimerMotionDetectionEnabled(enabled: boolean) {
  await getDb()
    .insert(schema.localSettings)
    .values({
      id: SETTINGS_ROW_ID,
      sleepTimerMotionDetectionEnabled: enabled,
    })
    .onConflictDoUpdate({
      target: [schema.localSettings.id],
      set: {
        sleepTimerMotionDetectionEnabled: sql`excluded.sleep_timer_motion_detection_enabled`,
      },
    });
}

export async function getSleepTimerSettings() {
  const response = await getDb().query.localSettings.findFirst({
    columns: {
      sleepTimer: true,
      sleepTimerEnabled: true,
      sleepTimerMotionDetectionEnabled: true,
    },
  });

  if (response) {
    return response;
  } else {
    return {
      sleepTimer: DEFAULT_SLEEP_TIMER_SECONDS,
      sleepTimerEnabled: DEFAULT_SLEEP_TIMER_ENABLED,
      sleepTimerMotionDetectionEnabled:
        DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
    };
  }
}
