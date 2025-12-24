/**
 * Tests for the seek utility module.
 *
 * This module handles debounced seeking with accumulation for TrackPlayer.
 * Uses Jest fake timers to test the timing logic.
 */

import { SeekSource } from "@/stores/player";
import { EventBus } from "@/utils/event-bus";
import { seek, seekImmediateNoLog } from "@/utils/seek";
import {
  mockTrackPlayerGetProgress,
  mockTrackPlayerGetRate,
  mockTrackPlayerSeekTo,
} from "@test/jest-setup";

// Spy on EventBus.emit to verify events
const eventBusSpy = jest.spyOn(EventBus, "emit");

describe("seek", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTrackPlayerGetProgress.mockReset();
    mockTrackPlayerGetRate.mockReset();
    mockTrackPlayerSeekTo.mockReset();
    eventBusSpy.mockClear();

    // Default mock values
    mockTrackPlayerGetProgress.mockResolvedValue({
      position: 100,
      duration: 3600,
    });
    mockTrackPlayerGetRate.mockResolvedValue(1.0);
    mockTrackPlayerSeekTo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Advance past all timers to reset module state
    jest.advanceTimersByTime(10000);
    jest.useRealTimers();
  });

  // ===========================================================================
  // seek() - basic functionality
  // ===========================================================================

  describe("seek()", () => {
    it("seeks forward by the given interval after short delay", async () => {
      await seek(10); // Seek forward 10 seconds

      // Should not seek immediately
      expect(mockTrackPlayerSeekTo).not.toHaveBeenCalled();

      // Advance past the short timer (500ms)
      jest.advanceTimersByTime(500);
      await Promise.resolve(); // Flush promises

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(110); // 100 + 10
    });

    it("seeks backward by negative interval", async () => {
      await seek(-30); // Seek back 30 seconds

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(70); // 100 - 30
    });

    it("accumulates multiple rapid seeks", async () => {
      await seek(10); // First seek
      await seek(10); // Second seek within window
      await seek(10); // Third seek

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Should only call seekTo once with accumulated value
      expect(mockTrackPlayerSeekTo).toHaveBeenCalledTimes(1);
      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(130); // 100 + 30
    });

    it("respects playback rate when calculating seek position", async () => {
      mockTrackPlayerGetRate.mockResolvedValue(1.5); // 1.5x speed

      await seek(10); // 10 second interval

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Position change = interval * rate = 10 * 1.5 = 15
      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(115); // 100 + 15
    });

    it("clamps seek position to not exceed duration", async () => {
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3590, // Near the end
        duration: 3600,
      });

      await seek(30); // Try to seek past end

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(3600); // Clamped to duration
    });

    it("clamps seek position to not go below zero", async () => {
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 20,
        duration: 3600,
      });

      await seek(-30); // Try to seek before start

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(0); // Clamped to 0
    });

    it("emits seekApplied event after short delay", async () => {
      await seek(10);

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
        position: 110,
        duration: 3600,
        userInitiated: true,
        source: SeekSource.REMOTE,
      });
    });

    it("emits seekCompleted event after long delay", async () => {
      await seek(10);

      // First, the short timer fires
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Then wait for the long timer (5000ms total from first call)
      jest.advanceTimersByTime(4500);
      await Promise.resolve();

      expect(eventBusSpy).toHaveBeenCalledWith(
        "seekCompleted",
        expect.objectContaining({
          fromPosition: 100,
          toPosition: 110,
          timestamp: expect.any(Date),
        }),
      );
    });

    it("resets accumulator after short timer fires", async () => {
      await seek(10);

      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(110);
      mockTrackPlayerSeekTo.mockClear();

      // New seek should start fresh (need to wait for long timer too)
      jest.advanceTimersByTime(5000);

      // Now we can start a new seek sequence
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 110, // Updated position
        duration: 3600,
      });

      await seek(20);
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(130); // 110 + 20
    });
  });

  // ===========================================================================
  // seekImmediateNoLog() - immediate seeking without event logging
  // ===========================================================================

  describe("seekImmediateNoLog()", () => {
    it("seeks immediately without accumulation", async () => {
      await seekImmediateNoLog(10);

      // Should seek immediately, no timer needed
      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(110);
    });

    it("respects playback rate", async () => {
      mockTrackPlayerGetRate.mockResolvedValue(2.0);

      await seekImmediateNoLog(10);

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(120); // 100 + 10 * 2
    });

    it("clamps to duration bounds", async () => {
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3590,
        duration: 3600,
      });

      await seekImmediateNoLog(30);

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(3600);
    });

    it("clamps to zero", async () => {
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 20,
        duration: 3600,
      });

      await seekImmediateNoLog(-30);

      expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(0);
    });

    it("emits seekApplied with userInitiated false", async () => {
      await seekImmediateNoLog(10);

      expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
        position: 110,
        duration: 3600,
        userInitiated: false,
        source: SeekSource.PAUSE,
      });
    });

    it("does NOT emit seekCompleted event", async () => {
      await seekImmediateNoLog(10);

      // Advance time to ensure no delayed events
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      expect(eventBusSpy).not.toHaveBeenCalledWith(
        "seekCompleted",
        expect.anything(),
      );
    });
  });
});
