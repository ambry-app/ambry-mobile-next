/* eslint-disable import/first */
// Mock the other services to prevent their initialization from running
jest.mock("@/services/sleep-timer-service", () => ({
  startMonitoring: jest.fn(),
}));

jest.mock("@/services/progress-save-service", () => ({
  startMonitoring: jest.fn(),
}));

jest.mock("@/services/event-recording-service", () => ({
  startMonitoring: jest.fn().mockResolvedValue(undefined),
}));

// Mock seek utils
const mockSeek = jest.fn();
const mockSeekImmediateNoLog = jest.fn().mockResolvedValue(undefined);
jest.mock("@/utils/seek", () => ({
  seek: (...args: unknown[]) => mockSeek(...args),
  seekImmediateNoLog: (...args: unknown[]) => mockSeekImmediateNoLog(...args),
}));

import * as EventRecording from "@/services/event-recording-service";
import { PlaybackService } from "@/services/playback-service";
import * as ProgressSave from "@/services/progress-save-service";
import * as SleepTimer from "@/services/sleep-timer-service";
import { EventBus } from "@/utils";
import {
  mockTrackPlayerAddEventListener,
  mockTrackPlayerPause,
  mockTrackPlayerPlay,
} from "@test/jest-setup";
/* eslint-enable import/first */

/**
 * Helper to get a registered event handler by event name.
 */
function getEventHandler(
  eventName: string,
): ((...args: unknown[]) => void) | undefined {
  const call = mockTrackPlayerAddEventListener.mock.calls.find(
    ([name]) => name === eventName,
  );
  return call?.[1] as ((...args: unknown[]) => void) | undefined;
}

describe("playback-service", () => {
  beforeEach(() => {
    mockTrackPlayerAddEventListener.mockReset();
    mockTrackPlayerPlay.mockReset();
    mockTrackPlayerPause.mockReset();
    mockSeek.mockReset();
    mockSeekImmediateNoLog.mockReset();
    jest.clearAllMocks();
  });

  describe("PlaybackService initialization", () => {
    it("registers TrackPlayer event listeners", async () => {
      await PlaybackService();

      // Should register listeners for key events
      expect(mockTrackPlayerAddEventListener).toHaveBeenCalled();

      const registeredEvents = mockTrackPlayerAddEventListener.mock.calls.map(
        (call) => call[0],
      );

      // Check that key events are registered
      expect(registeredEvents).toContain("playback-queue-ended");
      expect(registeredEvents).toContain("remote-duck");
      expect(registeredEvents).toContain("remote-jump-backward");
      expect(registeredEvents).toContain("remote-jump-forward");
      expect(registeredEvents).toContain("remote-pause");
      expect(registeredEvents).toContain("remote-play");
    });

    it("starts SleepTimer monitoring", async () => {
      await PlaybackService();

      expect(SleepTimer.startMonitoring).toHaveBeenCalled();
    });

    it("starts ProgressSave monitoring", async () => {
      await PlaybackService();

      expect(ProgressSave.startMonitoring).toHaveBeenCalled();
    });

    it("starts EventRecording monitoring", async () => {
      await PlaybackService();

      expect(EventRecording.startMonitoring).toHaveBeenCalled();
    });
  });

  describe("event handlers", () => {
    it("PlaybackQueueEnded emits playbackQueueEnded event", async () => {
      await PlaybackService();

      const handler = getEventHandler("playback-queue-ended");
      expect(handler).toBeDefined();

      const emitSpy = jest.spyOn(EventBus, "emit");
      handler!();

      expect(emitSpy).toHaveBeenCalledWith("playbackQueueEnded");
      emitSpy.mockRestore();
    });

    it("RemoteDuck emits remoteDuck event with args", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-duck");
      expect(handler).toBeDefined();

      const emitSpy = jest.spyOn(EventBus, "emit");
      const args = { paused: true, permanent: false };
      handler!(args);

      expect(emitSpy).toHaveBeenCalledWith("remoteDuck", args);
      emitSpy.mockRestore();
    });

    it("RemoteJumpBackward calls seek with negative interval", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-jump-backward");
      expect(handler).toBeDefined();

      handler!({ interval: 30 });

      expect(mockSeek).toHaveBeenCalledWith(-30);
    });

    it("RemoteJumpForward calls seek with positive interval", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-jump-forward");
      expect(handler).toBeDefined();

      handler!({ interval: 30 });

      expect(mockSeek).toHaveBeenCalledWith(30);
    });

    it("RemotePause pauses playback, seeks back, and emits event", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-pause");
      expect(handler).toBeDefined();

      const emitSpy = jest.spyOn(EventBus, "emit");
      await handler!();

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(mockSeekImmediateNoLog).toHaveBeenCalledWith(-1);
      expect(emitSpy).toHaveBeenCalledWith("playbackPaused", { remote: true });
      emitSpy.mockRestore();
    });

    it("RemotePlay starts playback and emits event", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-play");
      expect(handler).toBeDefined();

      const emitSpy = jest.spyOn(EventBus, "emit");
      await handler!();

      expect(mockTrackPlayerPlay).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("playbackStarted", { remote: true });
      emitSpy.mockRestore();
    });
  });
});
