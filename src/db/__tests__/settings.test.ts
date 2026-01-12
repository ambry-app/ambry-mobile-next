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
import { createLocalUserSettings, DEFAULT_TEST_SESSION } from "@test/factories";

const { getDb } = setupTestDatabase();

const userEmail = DEFAULT_TEST_SESSION.email;

describe("settings", () => {
  describe("setPreferredPlaybackRate", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setPreferredPlaybackRate(userEmail, 1.5);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings).toBeDefined();
      expect(settings?.preferredPlaybackRate).toBe(1.5);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        preferredPlaybackRate: 1.0,
      });

      await setPreferredPlaybackRate(userEmail, 2.0);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.preferredPlaybackRate).toBe(2.0);
    });

    it("does not affect other settings when updating", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        preferredPlaybackRate: 1.0,
        sleepTimer: 900,
        sleepTimerEnabled: true,
      });

      await setPreferredPlaybackRate(userEmail, 1.75);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.preferredPlaybackRate).toBe(1.75);
      expect(settings?.sleepTimer).toBe(900);
      expect(settings?.sleepTimerEnabled).toBe(true);
    });
  });

  describe("setSleepTimerEnabled", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerEnabled(userEmail, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings).toBeDefined();
      expect(settings?.sleepTimerEnabled).toBe(true);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimerEnabled: false,
      });

      await setSleepTimerEnabled(userEmail, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimerEnabled).toBe(true);
    });

    it("can disable sleep timer", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimerEnabled: true,
      });

      await setSleepTimerEnabled(userEmail, false);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimerEnabled).toBe(false);
    });
  });

  describe("setSleepTimerTime", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerTime(userEmail, 1800);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings).toBeDefined();
      expect(settings?.sleepTimer).toBe(1800);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimer: 600,
      });

      await setSleepTimerTime(userEmail, 1200);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimer).toBe(1200);
    });
  });

  describe("setSleepTimerMotionDetectionEnabled", () => {
    it("creates settings record if none exists", async () => {
      const db = getDb();

      await setSleepTimerMotionDetectionEnabled(userEmail, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings).toBeDefined();
      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("updates existing settings record", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimerMotionDetectionEnabled: false,
      });

      await setSleepTimerMotionDetectionEnabled(userEmail, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("can disable motion detection", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimerMotionDetectionEnabled: true,
      });

      await setSleepTimerMotionDetectionEnabled(userEmail, false);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(false);
    });

    it("does not affect other settings when updating", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimer: 900,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: false,
      });

      await setSleepTimerMotionDetectionEnabled(userEmail, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, userEmail),
      });

      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
      expect(settings?.sleepTimer).toBe(900);
      expect(settings?.sleepTimerEnabled).toBe(true);
    });
  });

  describe("getSleepTimerSettings", () => {
    it("returns defaults when no settings exist", async () => {
      const settings = await getSleepTimerSettings(userEmail);

      expect(settings.sleepTimer).toBe(DEFAULT_SLEEP_TIMER_SECONDS);
      expect(settings.sleepTimerEnabled).toBe(DEFAULT_SLEEP_TIMER_ENABLED);
      expect(settings.sleepTimerMotionDetectionEnabled).toBe(
        DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
      );
    });

    it("returns saved settings when they exist", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimer: 900,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: true,
      });

      const settings = await getSleepTimerSettings(userEmail);

      expect(settings.sleepTimer).toBe(900);
      expect(settings.sleepTimerEnabled).toBe(true);
      expect(settings.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("returns only sleep timer related fields", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail,
        sleepTimer: 1200,
        sleepTimerEnabled: false,
        sleepTimerMotionDetectionEnabled: true,
        preferredPlaybackRate: 2.0,
      });

      const settings = await getSleepTimerSettings(userEmail);

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

    it("returns settings for the correct user", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail: "user1@example.com",
        sleepTimer: 600,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: true,
      });
      await createLocalUserSettings(db, {
        userEmail: "user2@example.com",
        sleepTimer: 1800,
        sleepTimerEnabled: false,
        sleepTimerMotionDetectionEnabled: false,
      });

      const user1Settings = await getSleepTimerSettings("user1@example.com");
      const user2Settings = await getSleepTimerSettings("user2@example.com");

      expect(user1Settings.sleepTimer).toBe(600);
      expect(user1Settings.sleepTimerEnabled).toBe(true);
      expect(user1Settings.sleepTimerMotionDetectionEnabled).toBe(true);
      expect(user2Settings.sleepTimer).toBe(1800);
      expect(user2Settings.sleepTimerEnabled).toBe(false);
      expect(user2Settings.sleepTimerMotionDetectionEnabled).toBe(false);
    });
  });
});
