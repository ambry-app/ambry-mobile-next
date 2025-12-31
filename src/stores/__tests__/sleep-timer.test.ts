import {
  defaultSleepTimer,
  defaultSleepTimerEnabled,
  localUserSettings,
} from "@/db/schema";
import { Session } from "@/stores/session";
import {
  initializeSleepTimer,
  setSleepTimer,
  setSleepTimerState,
  setTriggerTime,
  useSleepTimer,
} from "@/stores/sleep-timer";
import { setupTestDatabase } from "@test/db-test-utils";
import { createLocalUserSettings, DEFAULT_TEST_SESSION } from "@test/factories";
import { resetStoreBeforeEach } from "@test/store-test-utils";

describe("sleep-timer store", () => {
  const { getDb } = setupTestDatabase();

  const testSession: Session = {
    url: DEFAULT_TEST_SESSION.url,
    email: DEFAULT_TEST_SESSION.email,
    token: "test-token",
  };

  resetStoreBeforeEach(useSleepTimer, {
    initialized: false,
    sleepTimer: defaultSleepTimer,
    sleepTimerEnabled: defaultSleepTimerEnabled,
    sleepTimerTriggerTime: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeSleepTimer", () => {
    it("loads settings from database and sets initialized", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail: testSession.email,
        sleepTimer: 1800, // 30 minutes
        sleepTimerEnabled: true,
      });

      await initializeSleepTimer(testSession);

      const state = useSleepTimer.getState();
      expect(state.initialized).toBe(true);
      expect(state.sleepTimer).toBe(1800);
      expect(state.sleepTimerEnabled).toBe(true);
    });

    it("uses defaults when no settings exist", async () => {
      await initializeSleepTimer(testSession);

      const state = useSleepTimer.getState();
      expect(state.initialized).toBe(true);
      expect(state.sleepTimer).toBe(defaultSleepTimer);
      expect(state.sleepTimerEnabled).toBe(defaultSleepTimerEnabled);
    });

    it("skips initialization if already initialized", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail: testSession.email,
        sleepTimer: 1800,
        sleepTimerEnabled: true,
      });

      // First initialization
      await initializeSleepTimer(testSession);
      expect(useSleepTimer.getState().sleepTimer).toBe(1800);

      // Change DB value
      await db.update(localUserSettings).set({ sleepTimer: 3600 });

      // Second initialization should skip
      await initializeSleepTimer(testSession);

      // Should still have original value
      expect(useSleepTimer.getState().sleepTimer).toBe(1800);
    });

    it("does not reset sleepTimerTriggerTime on initialization", async () => {
      // Set a trigger time before initialization (simulating persisted JS context)
      const triggerTime = Date.now() + 60000;
      useSleepTimer.setState({ sleepTimerTriggerTime: triggerTime });

      await initializeSleepTimer(testSession);

      // Trigger time should be preserved
      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBe(triggerTime);
    });
  });

  describe("setSleepTimerState", () => {
    it("enables sleep timer", async () => {
      await setSleepTimerState(testSession, true);

      expect(useSleepTimer.getState().sleepTimerEnabled).toBe(true);
    });

    it("disables sleep timer", async () => {
      // Start with enabled
      useSleepTimer.setState({ sleepTimerEnabled: true });

      await setSleepTimerState(testSession, false);

      expect(useSleepTimer.getState().sleepTimerEnabled).toBe(false);
    });

    it("resets trigger time when state changes", async () => {
      // Set a trigger time
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      await setSleepTimerState(testSession, true);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("persists enabled state to database", async () => {
      const db = getDb();

      await setSleepTimerState(testSession, true);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, testSession.email),
      });
      expect(settings?.sleepTimerEnabled).toBe(true);
    });
  });

  describe("setSleepTimer", () => {
    it("updates timer duration in store", async () => {
      await setSleepTimer(testSession, 2700); // 45 minutes

      expect(useSleepTimer.getState().sleepTimer).toBe(2700);
    });

    it("persists timer duration to database", async () => {
      const db = getDb();

      await setSleepTimer(testSession, 2700);

      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, testSession.email),
      });
      expect(settings?.sleepTimer).toBe(2700);
    });
  });

  describe("setTriggerTime", () => {
    it("sets trigger time in store", () => {
      const triggerTime = Date.now() + 60000;

      setTriggerTime(triggerTime);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBe(triggerTime);
    });

    it("clears trigger time when set to null", () => {
      // Set a trigger time first
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      setTriggerTime(null);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });
});
