/**
 * Tests for seek-service.ts
 *
 * Uses Detroit-style testing:
 * - Mock only native modules (react-native-track-player via jest-setup.ts)
 * - Use fake timers to control accumulation window
 *
 * The real track-player store, seek-ui-state store, and service logic runs.
 */

import { SEEK_ACCUMULATION_WINDOW } from "@/constants";
import { startNewPlaythrough } from "@/services/playthrough-operations";
import * as seekService from "@/services/seek-service";
import * as trackPlayerService from "@/services/track-player-service";
import {
  resetForTesting as resetSeekUIStore,
  useSeekUIState,
} from "@/stores/seek-ui-state";
import {
  resetForTesting as resetTrackPlayerStore,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import { createMedia, DEFAULT_TEST_SESSION } from "@test/factories";
import { resetTrackPlayerFake, trackPlayerFake } from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to set up a loaded playthrough for testing seek operations.
 * Uses real service functions instead of manually constructing data shapes.
 */
async function setupLoadedPlaythrough(
  options: {
    position?: number;
    rate?: number;
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

  if (options.rate !== undefined) {
    await trackPlayerService.setPlaybackRate(options.rate);
  }

  return { media };
}

describe("seek-service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerStore();
    resetSeekUIStore();
    // Reset module state by clearing any pending timers
    jest.runAllTimers();
  });

  afterEach(() => {
    // Flush any pending timers and restore real timers
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("seekTo (absolute seek)", () => {
    it("updates seek UI state immediately", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekTo(150, SeekSource.SCRUBBER);

      const uiState = useSeekUIState.getState();
      expect(uiState.userIsSeeking).toBe(true);
      expect(uiState.seekPosition).toBe(150);
      expect(uiState.seekEffectiveDiff).toBe(50); // 150 - 100
      expect(uiState.seekLastDirection).toBe("right");
    });

    it("applies seek after accumulation window", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekTo(150, SeekSource.SCRUBBER);

      // Before timer fires, TrackPlayer position is unchanged
      expect(trackPlayerFake.getState().position).toBe(100);

      // Advance past accumulation window
      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve(); // Allow async operations to complete

      // After timer fires, position should be updated
      expect(trackPlayerFake.getState().position).toBe(150);
    });

    it("clears seek UI state after seek is applied", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekTo(150, SeekSource.SCRUBBER);
      expect(useSeekUIState.getState().userIsSeeking).toBe(true);

      // Use runAllTimersAsync to properly handle async operations within timers
      await jest.runAllTimersAsync();

      const uiState = useSeekUIState.getState();
      expect(uiState.userIsSeeking).toBe(false);
      expect(uiState.seekPosition).toBeNull();
    });

    it("sets direction to left when seeking backward", async () => {
      await setupLoadedPlaythrough({ position: 200 });

      await seekService.seekTo(50, SeekSource.SCRUBBER);

      expect(useSeekUIState.getState().seekLastDirection).toBe("left");
      expect(useSeekUIState.getState().seekEffectiveDiff).toBe(-150);
    });

    it("clamps position to 0 at minimum", async () => {
      await setupLoadedPlaythrough({ position: 50 });

      await seekService.seekTo(-100, SeekSource.SCRUBBER);

      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      // Should be clamped to 0, not -100
      expect(trackPlayerFake.getState().position).toBe(0);
    });

    it("clamps position to duration at maximum", async () => {
      await setupLoadedPlaythrough({ position: 50, duration: "300.0" });

      await seekService.seekTo(500, SeekSource.SCRUBBER);

      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      // Should be clamped to 300, not 500
      expect(trackPlayerFake.getState().position).toBe(300);
    });
  });

  describe("seekRelative (button seek)", () => {
    it("accumulates relative seeks within window", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      // Multiple rapid button presses (15 seconds each)
      await seekService.seekRelative(15, SeekSource.BUTTON);
      await seekService.seekRelative(15, SeekSource.BUTTON);
      await seekService.seekRelative(15, SeekSource.BUTTON);

      // UI should show accumulated target
      const uiState = useSeekUIState.getState();
      expect(uiState.seekPosition).toBe(145); // 100 + 45
      expect(uiState.seekEffectiveDiff).toBe(45);
      expect(uiState.seekLastDirection).toBe("right");

      // Wait for timer
      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      // All 3 seeks should be applied as single jump
      expect(trackPlayerFake.getState().position).toBe(145);
    });

    it("accumulates backward seeks", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekRelative(-15, SeekSource.BUTTON);
      await seekService.seekRelative(-15, SeekSource.BUTTON);

      const uiState = useSeekUIState.getState();
      expect(uiState.seekPosition).toBe(70); // 100 - 30
      expect(uiState.seekLastDirection).toBe("left");

      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      expect(trackPlayerFake.getState().position).toBe(70);
    });

    it("accounts for playback rate when seeking", async () => {
      await setupLoadedPlaythrough({ position: 100, rate: 2.0 });

      // At 2x rate, 15 seconds of content = 30 seconds seek
      await seekService.seekRelative(15, SeekSource.BUTTON);

      const uiState = useSeekUIState.getState();
      expect(uiState.seekPosition).toBe(130); // 100 + 15 * 2.0

      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      expect(trackPlayerFake.getState().position).toBe(130);
    });

    it("resets accumulation after seek is applied", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      // First batch of seeks
      await seekService.seekRelative(15, SeekSource.BUTTON);
      await jest.runAllTimersAsync();
      expect(trackPlayerFake.getState().position).toBe(115);

      // Second batch should start fresh from new position (115 + 15 = 130)
      await seekService.seekRelative(15, SeekSource.BUTTON);
      await jest.runAllTimersAsync();

      expect(trackPlayerFake.getState().position).toBe(130);
    });

    it("handles mixed forward and backward seeks", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekRelative(30, SeekSource.BUTTON);
      await seekService.seekRelative(-15, SeekSource.BUTTON);

      // Net: +15 from base
      const uiState = useSeekUIState.getState();
      expect(uiState.seekPosition).toBe(115);

      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);
      await Promise.resolve();

      expect(trackPlayerFake.getState().position).toBe(115);
    });

    it("restarts timer on each new seek", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekRelative(15, SeekSource.BUTTON);

      // Advance partway through window
      jest.advanceTimersByTime(500);

      // Another seek should restart the timer
      await seekService.seekRelative(15, SeekSource.BUTTON);

      // Advance partway again - original timer would have fired by now
      jest.advanceTimersByTime(500);

      // Seek should NOT have been applied yet (timer was restarted)
      expect(useSeekUIState.getState().userIsSeeking).toBe(true);

      // Complete the new timer window
      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW - 500);
      await Promise.resolve();

      // Now it should be applied
      expect(trackPlayerFake.getState().position).toBe(130);
    });
  });

  describe("edge cases", () => {
    it("prevents concurrent seek applications", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      // Start a seek
      await seekService.seekTo(150, SeekSource.SCRUBBER);

      // Trigger the timer but don't fully await the async apply
      jest.advanceTimersByTime(SEEK_ACCUMULATION_WINDOW);

      // Immediate attempt to seek should be ignored during apply (isApplying flag)
      await seekService.seekTo(200, SeekSource.SCRUBBER);

      // Complete async operations
      await jest.runAllTimersAsync();

      // First seek should have been applied
      expect(trackPlayerFake.getState().position).toBe(150);
    });
  });

  describe("seek sources", () => {
    it("passes SCRUBBER source to track-player-service", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekTo(150, SeekSource.SCRUBBER);
      await jest.runAllTimersAsync();

      const lastSeek = useTrackPlayer.getState().lastSeek;
      expect(lastSeek?.source).toBe(SeekSource.SCRUBBER);
    });

    it("passes BUTTON source to track-player-service", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekRelative(15, SeekSource.BUTTON);
      await jest.runAllTimersAsync();

      const lastSeek = useTrackPlayer.getState().lastSeek;
      expect(lastSeek?.source).toBe(SeekSource.BUTTON);
    });

    it("passes REMOTE source to track-player-service", async () => {
      await setupLoadedPlaythrough({ position: 100 });

      await seekService.seekRelative(15, SeekSource.REMOTE);
      await jest.runAllTimersAsync();

      const lastSeek = useTrackPlayer.getState().lastSeek;
      expect(lastSeek?.source).toBe(SeekSource.REMOTE);
    });
  });
});
