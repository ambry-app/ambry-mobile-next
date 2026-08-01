import {
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
} from "@/constants";
import {
  getSleepTimerSettings,
  setPreferredPlaybackRate,
  setSleepTimerEnabled,
  setSleepTimerMotionDetectionEnabled,
  setSleepTimerTime,
} from "@/db/settings";
import { setupTestDatabase } from "@test/db-test-utils";
import { createLocalSettings } from "@test/factories";

const { getDb } = setupTestDatabase();

describe("settings", () => {
  describe("setPreferredPlaybackRate", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setPreferredPlaybackRate(1.5);

      const settings = await db.query.localSettings.findFirst();

      expect(settings).toBeDefined();
      expect(settings?.preferredPlaybackRate).toBe(1.5);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        preferredPlaybackRate: 1.0,
      });

      await setPreferredPlaybackRate(2.0);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.preferredPlaybackRate).toBe(2.0);
    });

    it("does not affect other settings when updating", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        preferredPlaybackRate: 1.0,
        sleepTimer: 900,
        sleepTimerEnabled: true,
      });

      await setPreferredPlaybackRate(1.75);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.preferredPlaybackRate).toBe(1.75);
      expect(settings?.sleepTimer).toBe(900);
      expect(settings?.sleepTimerEnabled).toBe(true);
    });
  });

  describe("setSleepTimerEnabled", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerEnabled(true);

      const settings = await db.query.localSettings.findFirst();

      expect(settings).toBeDefined();
      expect(settings?.sleepTimerEnabled).toBe(true);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimerEnabled: false,
      });

      await setSleepTimerEnabled(true);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimerEnabled).toBe(true);
    });

    it("can disable sleep timer", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimerEnabled: true,
      });

      await setSleepTimerEnabled(false);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimerEnabled).toBe(false);
    });
  });

  describe("setSleepTimerTime", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerTime(1800);

      const settings = await db.query.localSettings.findFirst();

      expect(settings).toBeDefined();
      expect(settings?.sleepTimer).toBe(1800);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimer: 600,
      });

      await setSleepTimerTime(1200);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimer).toBe(1200);
    });
  });

  describe("setSleepTimerMotionDetectionEnabled", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerMotionDetectionEnabled(true);

      const settings = await db.query.localSettings.findFirst();

      expect(settings).toBeDefined();
      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimerMotionDetectionEnabled: false,
      });

      await setSleepTimerMotionDetectionEnabled(true);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("can disable motion detection", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimerMotionDetectionEnabled: true,
      });

      await setSleepTimerMotionDetectionEnabled(false);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(false);
    });

    it("does not affect other settings when updating", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimer: 900,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: false,
      });

      await setSleepTimerMotionDetectionEnabled(true);

      const settings = await db.query.localSettings.findFirst();

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
      expect(settings?.sleepTimer).toBe(900);
      expect(settings?.sleepTimerEnabled).toBe(true);
    });
  });

  describe("getSleepTimerSettings", () => {
    it("returns defaults when no settings exist", async () => {
      const settings = await getSleepTimerSettings();

      expect(settings.sleepTimer).toBe(DEFAULT_SLEEP_TIMER_SECONDS);
      expect(settings.sleepTimerEnabled).toBe(DEFAULT_SLEEP_TIMER_ENABLED);
      expect(settings.sleepTimerMotionDetectionEnabled).toBe(
        DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
      );
    });

    it("returns saved settings when they exist", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimer: 900,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: true,
      });

      const settings = await getSleepTimerSettings();

      expect(settings.sleepTimer).toBe(900);
      expect(settings.sleepTimerEnabled).toBe(true);
      expect(settings.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("returns only sleep timer related fields", async () => {
      const db = getDb();
      await createLocalSettings(db, {
        sleepTimer: 1200,
        sleepTimerEnabled: false,
        sleepTimerMotionDetectionEnabled: true,
        preferredPlaybackRate: 2.0,
      });

      const settings = await getSleepTimerSettings();

      // Should only have sleep timer fields, not other settings like playback rate
      expect(Object.keys(settings).sort()).toEqual([
        "sleepTimer",
        "sleepTimerEnabled",
        "sleepTimerMotionDetectionEnabled",
      ]);
      expect(settings.sleepTimer).toBe(1200);
      expect(settings.sleepTimerEnabled).toBe(false);
      expect(settings.sleepTimerMotionDetectionEnabled).toBe(true);
    });
  });
});
