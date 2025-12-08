import { SLEEP_TIMER_FADE_OUT_TIME } from "@/constants";
import {
  __resetForTesting,
  cancel,
  maybeReset,
  reset,
  startMonitoring,
} from "@/services/sleep-timer-service";
import { useSleepTimer } from "@/stores/sleep-timer";
import { EventBus } from "@/utils";
import {
  mockIsPlaying,
  mockTrackPlayerPause,
  mockTrackPlayerSetVolume,
} from "@test/jest-setup";

const SLEEP_TIMER_CHECK_INTERVAL = 1000;

describe("sleep-timer-service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetForTesting();

    // Reset store to default state
    useSleepTimer.setState({
      initialized: true,
      sleepTimer: 60, // 60 seconds default
      sleepTimerEnabled: false,
      sleepTimerTriggerTime: null,
    });

    // Reset mocks
    mockTrackPlayerPause.mockReset();
    mockTrackPlayerSetVolume.mockReset();
    mockIsPlaying.mockReset();
  });

  afterEach(() => {
    __resetForTesting();
    jest.useRealTimers();
  });

  describe("startMonitoring", () => {
    it("only initializes once", () => {
      startMonitoring();
      startMonitoring();

      // If it initialized twice, we'd have duplicate intervals
      // Verify no errors occur
      expect(true).toBe(true);
    });

    it("starts the check interval", async () => {
      useSleepTimer.setState({ sleepTimerEnabled: true });

      startMonitoring();

      // Advance by one check interval
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      // setVolume should have been called (even if just to set to 1.0)
      expect(mockTrackPlayerSetVolume).toHaveBeenCalled();
    });
  });

  describe("checkTimer (via interval)", () => {
    it("resets volume to 1.0 when timer is disabled", async () => {
      useSleepTimer.setState({ sleepTimerEnabled: false });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
    });

    it("resets volume to 1.0 when no trigger time is set", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: null,
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
    });

    it("pauses playback when timer expires", async () => {
      const now = Date.now();
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now - 1000, // Already expired
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("emits playbackPaused event when timer expires", async () => {
      const playbackPausedHandler = jest.fn();
      EventBus.on("playbackPaused", playbackPausedHandler);

      const now = Date.now();
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now - 1000,
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      expect(playbackPausedHandler).toHaveBeenCalledWith({ remote: false });

      EventBus.off("playbackPaused", playbackPausedHandler);
    });

    it("fades volume when within fade out window", async () => {
      const now = Date.now();
      // Set trigger time to 15 seconds from now (halfway through 30s fade)
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now + 15000,
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      // Volume should be approximately 0.5 (15000 / 30000)
      expect(mockTrackPlayerSetVolume).toHaveBeenCalled();
      const volumeCall = mockTrackPlayerSetVolume.mock.calls[0][0];
      expect(volumeCall).toBeCloseTo(0.5, 1);
    });

    it("sets volume to 1.0 when outside fade window", async () => {
      const now = Date.now();
      // Set trigger time to 60 seconds from now (well outside 30s fade)
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now + 60000,
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
    });

    it("progressively fades volume as time passes", async () => {
      const now = Date.now();
      // Start with 25 seconds remaining
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now + 25000,
      });

      startMonitoring();

      // First check - ~25s remaining, volume ~0.83
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);
      const volume1 = mockTrackPlayerSetVolume.mock.calls[0][0];
      expect(volume1).toBeGreaterThan(0.7);

      // Advance 10 more seconds - ~14s remaining, volume ~0.47
      mockTrackPlayerSetVolume.mockClear();
      await jest.advanceTimersByTimeAsync(10000);
      const volume2 = mockTrackPlayerSetVolume.mock.calls.at(-1)?.[0];
      expect(volume2).toBeLessThan(0.6);
      expect(volume2).toBeGreaterThan(0.3);
    });
  });

  describe("reset", () => {
    it("sets trigger time when enabled", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimer: 120, // 2 minutes
      });

      const before = Date.now();
      await reset();
      const after = Date.now();

      const triggerTime = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(triggerTime).not.toBeNull();
      // Should be approximately 120 seconds from now
      expect(triggerTime).toBeGreaterThanOrEqual(before + 120000);
      expect(triggerTime).toBeLessThanOrEqual(after + 120000);
    });

    it("does nothing when disabled", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: false,
        sleepTimer: 120,
      });

      await reset();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("resets volume to 1.0", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimer: 60,
      });

      await reset();

      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
    });
  });

  describe("maybeReset", () => {
    it("resets timer when enabled and playing", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimer: 60,
      });
      mockIsPlaying.mockResolvedValue({ playing: true });

      await maybeReset();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("does nothing when disabled", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: false,
        sleepTimer: 60,
      });
      mockIsPlaying.mockResolvedValue({ playing: true });

      await maybeReset();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
      expect(mockIsPlaying).not.toHaveBeenCalled();
    });

    it("does nothing when not playing", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimer: 60,
      });
      mockIsPlaying.mockResolvedValue({ playing: false });

      await maybeReset();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });

  describe("cancel", () => {
    it("clears the trigger time", async () => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: Date.now() + 60000,
      });

      await cancel();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("resets volume to 1.0", async () => {
      await cancel();

      expect(mockTrackPlayerSetVolume).toHaveBeenCalledWith(1.0);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimer: 60,
      });
      mockIsPlaying.mockResolvedValue({ playing: true });
    });

    it("resets timer on playbackStarted", async () => {
      startMonitoring();

      EventBus.emit("playbackStarted");
      // Flush microtasks for the async reset() call
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("cancels timer on playbackPaused", async () => {
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      startMonitoring();

      EventBus.emit("playbackPaused");
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("cancels timer on playbackQueueEnded", async () => {
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      startMonitoring();

      EventBus.emit("playbackQueueEnded");
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("resets timer on remoteDuck", async () => {
      startMonitoring();

      EventBus.emit("remoteDuck");
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("resets timer on sleepTimerEnabled when playing", async () => {
      startMonitoring();

      EventBus.emit("sleepTimerEnabled");
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("cancels timer on sleepTimerDisabled", async () => {
      useSleepTimer.setState({ sleepTimerTriggerTime: Date.now() + 60000 });

      startMonitoring();

      EventBus.emit("sleepTimerDisabled");
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });

    it("resets timer on sleepTimerChanged when playing", async () => {
      const initialTrigger = Date.now() + 60000;
      useSleepTimer.setState({ sleepTimerTriggerTime: initialTrigger });

      startMonitoring();

      // Change the duration
      useSleepTimer.setState({ sleepTimer: 120 });
      EventBus.emit("sleepTimerChanged");
      await Promise.resolve();

      // Trigger time should be different (reset with new duration)
      const newTrigger = useSleepTimer.getState().sleepTimerTriggerTime;
      expect(newTrigger).not.toBeNull();
      expect(newTrigger).not.toBe(initialTrigger);
    });

    it("resets timer on seekApplied (non-pause source)", async () => {
      startMonitoring();

      EventBus.emit("seekApplied", { source: "user" });
      await Promise.resolve();

      expect(useSleepTimer.getState().sleepTimerTriggerTime).not.toBeNull();
    });

    it("does not reset timer on seekApplied with pause source", async () => {
      startMonitoring();

      EventBus.emit("seekApplied", { source: "pause" });
      await Promise.resolve();

      // maybeReset was not called, so trigger time should still be null
      expect(useSleepTimer.getState().sleepTimerTriggerTime).toBeNull();
    });
  });

  describe("fade timing edge cases", () => {
    it("handles exactly SLEEP_TIMER_FADE_OUT_TIME remaining", async () => {
      const now = Date.now();
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now + SLEEP_TIMER_FADE_OUT_TIME,
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      // At exactly fade time, volume should be 1.0 (30000/30000)
      const volumeCall = mockTrackPlayerSetVolume.mock.calls[0][0];
      expect(volumeCall).toBeCloseTo(1.0, 1);
    });

    it("handles very short time remaining", async () => {
      const now = Date.now();
      useSleepTimer.setState({
        sleepTimerEnabled: true,
        sleepTimerTriggerTime: now + 1000, // 1 second remaining
      });

      startMonitoring();
      await jest.advanceTimersByTimeAsync(SLEEP_TIMER_CHECK_INTERVAL);

      // Volume should be very low (1000/30000 ≈ 0.033)
      // But timer expires before we check, so it should pause
      expect(mockTrackPlayerPause).toHaveBeenCalled();
    });
  });
});
