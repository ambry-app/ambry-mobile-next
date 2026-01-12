/**
 * Tests for sleep-timer-service.ts
 *
 * Uses Detroit-style testing:
 * - Real database (test in-memory SQLite)
 * - Real stores (sleep-timer, track-player)
 * - Real track-player-service for state setup
 * - Mock only native modules (react-native-track-player via jest-setup.ts)
 * - Fake timers for interval checks
 *
 * Note: The sleep timer service sets up subscriptions once during initialize().
 * We call initialize() in beforeEach which means subscriptions accumulate
 * across tests in the same describe block. Tests are designed to account for this.
 */

import {
  DEFAULT_SLEEP_TIMER_ENABLED,
  DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
  DEFAULT_SLEEP_TIMER_SECONDS,
  SLEEP_TIMER_PAUSE_REWIND_SECONDS,
} from "@/constants";
import { startNewPlaythrough } from "@/services/playthrough-operations";
import * as sleepTimerService from "@/services/sleep-timer-service";
import { resetForTesting as resetSleepTimerService } from "@/services/sleep-timer-service";
import * as trackPlayerService from "@/services/track-player-service";
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import { useSleepTimer } from "@/stores/sleep-timer";
import {
  PlayPauseSource,
  PlayPauseType,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createLocalUserSettings,
  createMedia,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockShakeDetectorStart,
  mockShakeDetectorStop,
  resetShakeDetectorMocks,
  resetTrackPlayerFake,
  trackPlayerFake,
} from "@test/jest-setup";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to set up a loaded playthrough for testing.
 * Creates media and starts a new playthrough.
 */
async function setupLoadedPlaythrough(
  options: {
    position?: number;
    duration?: string;
  } = {},
) {
  const db = getDb();

  const media = await createMedia(db, {
    duration: options.duration ?? "300.0",
    chapters: [{ id: "ch-1", title: "Chapter 1", startTime: 0, endTime: null }],
  });

  await startNewPlaythrough(session, media.id);

  if (options.position !== undefined) {
    await trackPlayerService.seekTo(options.position, SeekSource.INTERNAL);
  }

  return { media };
}

describe("sleep-timer-service", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetShakeDetectorMocks();
    // Initialize track player service to set up event listeners
    await trackPlayerService.initialize();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    // Clean up service state to prevent subscription accumulation
    resetTrackPlayerService();
    resetSleepTimerService();
  });

  describe("initialize", () => {
    it("loads settings from database and sets store state", async () => {
      const db = getDb();
      await createLocalUserSettings(db, {
        userEmail: session.email,
        sleepTimer: 1800,
        sleepTimerEnabled: true,
        sleepTimerMotionDetectionEnabled: true,
      });

      await sleepTimerService.initialize(session);

      const state = useSleepTimer.getState();
      expect(state.initialized).toBe(true);
      expect(state.sleepTimer).toBe(1800);
      expect(state.sleepTimerEnabled).toBe(true);
      expect(state.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("uses defaults when no settings exist in database", async () => {
      await sleepTimerService.initialize(session);

      const state = useSleepTimer.getState();
      expect(state.initialized).toBe(true);
      expect(state.sleepTimer).toBe(DEFAULT_SLEEP_TIMER_SECONDS);
      expect(state.sleepTimerEnabled).toBe(DEFAULT_SLEEP_TIMER_ENABLED);
      expect(state.sleepTimerMotionDetectionEnabled).toBe(
        DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED,
      );
    });

    it("skips if already initialized", async () => {
      useSleepTimer.setState({ initialized: true, sleepTimer: 999 });

      await sleepTimerService.initialize(session);

      // Should not have changed the value
      expect(useSleepTimer.getState().sleepTimer).toBe(999);
    });
  });

  describe("setSleepTimerEnabled", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
    });

    it("updates store state", async () => {
      await sleepTimerService.setSleepTimerEnabled(session, true);

      expect(useSleepTimer.getState().sleepTimerEnabled).toBe(true);
    });

    it("persists to database", async () => {
      await sleepTimerService.setSleepTimerEnabled(session, true);

      const db = getDb();
      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, session.email),
      });
      expect(settings?.sleepTimerEnabled).toBe(true);
    });

    it("starts timer when enabled and playing", async () => {
      // Load a playthrough and start playing through the service
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);

      await sleepTimerService.setSleepTimerEnabled(session, true);

      // Trigger time should be set
      const triggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(triggerTime).not.toBeNull();
    });

    it("stops timer when disabled", async () => {
      // Set up an active timer with a playing playthrough
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      await sleepTimerService.setSleepTimerEnabled(session, true);
      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();

      // Disable it
      await sleepTimerService.setSleepTimerEnabled(session, false);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("clears trigger time when enabling but not playing", async () => {
      // Load playthrough but don't start playing
      await setupLoadedPlaythrough({ position: 100 });
      await sleepTimerService.setSleepTimerEnabled(session, true);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });

  describe("setSleepTimerTime", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
    });

    it("updates store state", async () => {
      await sleepTimerService.setSleepTimerTime(session, 1200);

      expect(useSleepTimer.getState().sleepTimer).toBe(1200);
    });

    it("persists to database", async () => {
      await sleepTimerService.setSleepTimerTime(session, 1200);

      const db = getDb();
      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, session.email),
      });
      expect(settings?.sleepTimer).toBe(1200);
    });

    it("resets trigger time when timer is active", async () => {
      // Start with an active timer
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      await sleepTimerService.setSleepTimerEnabled(session, true);

      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      expect(originalTriggerTime).not.toBeNull();

      // Advance time a bit
      jest.advanceTimersByTime(5000);

      // Change the duration
      await sleepTimerService.setSleepTimerTime(session, 1800);

      // Trigger time should have been reset (new time based on new duration)
      const newTriggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(newTriggerTime).not.toBeNull();
      expect(newTriggerTime).not.toBe(originalTriggerTime);
    });

    it("does not reset trigger time when timer is not active", async () => {
      // Timer not active
      await sleepTimerService.setSleepTimerTime(session, 1800);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });

  describe("setSleepTimerMotionDetectionEnabled", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
    });

    it("updates store state", async () => {
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );

      expect(useSleepTimer.getState().sleepTimerMotionDetectionEnabled).toBe(
        true,
      );
    });

    it("persists to database", async () => {
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );

      const db = getDb();
      const settings = await db.query.localUserSettings.findFirst({
        where: (s, { eq }) => eq(s.userEmail, session.email),
      });
      expect(settings?.sleepTimerMotionDetectionEnabled).toBe(true);
    });

    it("starts motion detection when enabled and timer is active", async () => {
      // Start with sleep timer enabled and playing
      await setupLoadedPlaythrough({ position: 100 });
      await sleepTimerService.setSleepTimerEnabled(session, true);
      await trackPlayerService.play(PlayPauseSource.USER);
      // Use async timer to let the async start() complete
      await jest.advanceTimersByTimeAsync(100);

      // Motion detection should not be running yet (disabled by default)
      expect(mockShakeDetectorStart).not.toHaveBeenCalled();

      // Enable motion detection
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );

      // Motion detection should now be started
      expect(mockShakeDetectorStart).toHaveBeenCalled();
    });

    it("stops motion detection when disabled and timer is active", async () => {
      // Start with motion detection enabled
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );
      await setupLoadedPlaythrough({ position: 100 });
      await sleepTimerService.setSleepTimerEnabled(session, true);
      await trackPlayerService.play(PlayPauseSource.USER);
      // Use async timer to let the async start() complete
      await jest.advanceTimersByTimeAsync(100);

      // Motion detection should be running
      expect(mockShakeDetectorStart).toHaveBeenCalled();
      mockShakeDetectorStart.mockClear();

      // Disable motion detection
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        false,
      );

      // Motion detection should be stopped
      expect(mockShakeDetectorStop).toHaveBeenCalled();
    });

    it("does not start motion detection when timer is not active", async () => {
      // Enable motion detection without timer active
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );

      // Motion detection should not start
      expect(mockShakeDetectorStart).not.toHaveBeenCalled();
    });
  });

  describe("motion detection integration", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
      // Enable motion detection
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        true,
      );
      await sleepTimerService.setSleepTimerEnabled(session, true);
    });

    it("starts motion detection when playback starts and motion detection is enabled", async () => {
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      // Use async timer to let the async start() complete
      await jest.advanceTimersByTimeAsync(100);

      expect(mockShakeDetectorStart).toHaveBeenCalled();
    });

    it("stops motion detection when playback pauses", async () => {
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      await jest.advanceTimersByTimeAsync(100);
      mockShakeDetectorStop.mockClear();

      await trackPlayerService.pause(PlayPauseSource.USER);
      await jest.advanceTimersByTimeAsync(100);

      expect(mockShakeDetectorStop).toHaveBeenCalled();
    });

    it("does not start motion detection when motion detection is disabled", async () => {
      // Disable motion detection
      await sleepTimerService.setSleepTimerMotionDetectionEnabled(
        session,
        false,
      );

      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      await jest.advanceTimersByTimeAsync(100);

      expect(mockShakeDetectorStart).not.toHaveBeenCalled();
    });
  });

  describe("play/pause event handling", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
      await sleepTimerService.setSleepTimerEnabled(session, true);
      await setupLoadedPlaythrough({ position: 100 });
    });

    it("starts timer on play event", async () => {
      // Play through the service
      await trackPlayerService.play(PlayPauseSource.USER);

      // Advance timers to let subscriptions fire and process
      jest.advanceTimersByTime(100);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("stops timer on pause event", async () => {
      // First start the timer via play
      await trackPlayerService.play(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);
      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();

      // Now pause through the service
      await trackPlayerService.pause(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("ignores INTERNAL play/pause events", async () => {
      // First start the timer with a USER event
      await trackPlayerService.play(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);
      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      expect(originalTriggerTime).not.toBeNull();

      // INTERNAL pause should not stop the timer
      await trackPlayerService.pause(PlayPauseSource.INTERNAL);
      jest.advanceTimersByTime(100);

      // Timer should still be set (unchanged)
      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBe(
        originalTriggerTime,
      );
    });

    it("handles REMOTE play events", async () => {
      await trackPlayerService.play(PlayPauseSource.REMOTE);
      jest.advanceTimersByTime(100);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });
  });

  describe("seek event handling", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
      await sleepTimerService.setSleepTimerEnabled(session, true);

      // Load playthrough and start playing
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);
    });

    it("resets trigger time on user seek", async () => {
      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      expect(originalTriggerTime).not.toBeNull();

      // Advance time
      jest.advanceTimersByTime(5000);

      // User seeks through the service
      await trackPlayerService.seekTo(150, SeekSource.SCRUBBER);
      jest.advanceTimersByTime(100);

      const newTriggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(newTriggerTime).not.toBe(originalTriggerTime);
      expect(newTriggerTime).toBeGreaterThan(originalTriggerTime!);
    });

    it("resets trigger time on button seek", async () => {
      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      jest.advanceTimersByTime(5000);

      await trackPlayerService.seekTo(150, SeekSource.BUTTON);
      jest.advanceTimersByTime(100);

      const newTriggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(newTriggerTime).not.toBe(originalTriggerTime);
    });

    it("resets trigger time on chapter seek", async () => {
      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      jest.advanceTimersByTime(5000);

      await trackPlayerService.seekTo(150, SeekSource.CHAPTER);
      jest.advanceTimersByTime(100);

      const newTriggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(newTriggerTime).not.toBe(originalTriggerTime);
    });

    it("ignores INTERNAL seeks", async () => {
      const originalTriggerTime =
        useSleepTimer.getState().sleepTimerTriggerTime;
      jest.advanceTimersByTime(5000);

      await trackPlayerService.seekTo(150, SeekSource.INTERNAL);
      jest.advanceTimersByTime(100);

      // Should not have changed
      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBe(
        originalTriggerTime,
      );
    });
  });

  describe("timer check and trigger", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
      useSleepTimer.setState({ sleepTimer: 60 }); // 60 second timer for easier testing
      await sleepTimerService.setSleepTimerEnabled(session, true);

      // Set up loaded playthrough and start playing
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);
    });

    it("pauses playback when timer expires", async () => {
      // Advance past the timer duration (60 seconds + buffer for interval)
      // Use advanceTimersByTimeAsync to handle async callbacks in intervals
      await jest.advanceTimersByTimeAsync(61000);

      // Should have paused
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PAUSE,
      );
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.SLEEP_TIMER,
      );
    });

    it("rewinds by configured amount on sleep timer pause", async () => {
      await jest.advanceTimersByTimeAsync(61000);

      // Should have rewound by SLEEP_TIMER_PAUSE_REWIND_SECONDS (10s * 1.0 rate)
      const expectedPosition = 100 - SLEEP_TIMER_PAUSE_REWIND_SECONDS;
      expect(trackPlayerFake.getState().position).toBe(expectedPosition);
    });

    it("fades volume in last 30 seconds", async () => {
      // Advance to ~15 seconds remaining (60 - 45 = 15 seconds remaining)
      jest.advanceTimersByTime(45000);

      const volume = trackPlayerFake.getState().volume;
      // At 15 seconds remaining: 15000 / 30000 = 0.5
      expect(volume).toBeCloseTo(0.5, 1);
    });

    it("restores volume to 1.0 when timer is stopped", async () => {
      // Advance into fade zone
      jest.advanceTimersByTime(45000);
      expect(trackPlayerFake.getState().volume).toBeLessThan(1);

      // Stop via pause through the service
      await trackPlayerService.pause(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);

      expect(trackPlayerFake.getState().volume).toBe(1);
    });
  });

  describe("timer not enabled", () => {
    beforeEach(async () => {
      await sleepTimerService.initialize(session);
      // Sleep timer is disabled by default
    });

    it("does not set trigger time when playing", async () => {
      await setupLoadedPlaythrough({ position: 100 });
      await trackPlayerService.play(PlayPauseSource.USER);
      jest.advanceTimersByTime(100);

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });
});
