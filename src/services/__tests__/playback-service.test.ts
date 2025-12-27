/* eslint-disable import/first */
// Mock the coordinator to verify it's called correctly
const mockOnPlay = jest.fn();
const mockOnPause = jest.fn();
const mockOnQueueEnded = jest.fn();
const mockOnRemoteDuck = jest.fn();
const mockInitialize = jest.fn();
const mockSetPlayerProgressUpdater = jest.fn();

jest.mock("@/services/playback-coordinator", () => ({
  onPlay: (...args: unknown[]) => mockOnPlay(...args),
  onPause: (...args: unknown[]) => mockOnPause(...args),
  onQueueEnded: (...args: unknown[]) => mockOnQueueEnded(...args),
  onRemoteDuck: (...args: unknown[]) => mockOnRemoteDuck(...args),
  initialize: (...args: unknown[]) => mockInitialize(...args),
  setPlayerProgressUpdater: (...args: unknown[]) =>
    mockSetPlayerProgressUpdater(...args),
}));

// Mock event-recording-service
jest.mock("@/services/event-recording-service", () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
}));

// Mock the player store
jest.mock("@/stores/player", () => ({
  setProgress: jest.fn(),
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
    mockOnPlay.mockReset();
    mockOnPause.mockReset();
    mockOnQueueEnded.mockReset();
    mockOnRemoteDuck.mockReset();
    mockInitialize.mockReset();
    mockSetPlayerProgressUpdater.mockReset();
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

    it("initializes EventRecording", async () => {
      await PlaybackService();

      expect(EventRecording.initialize).toHaveBeenCalled();
    });

    it("initializes the Coordinator", async () => {
      await PlaybackService();

      expect(mockSetPlayerProgressUpdater).toHaveBeenCalled();
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe("event handlers", () => {
    it("PlaybackQueueEnded calls Coordinator.onQueueEnded", async () => {
      await PlaybackService();

      const handler = getEventHandler("playback-queue-ended");
      expect(handler).toBeDefined();

      handler!();

      expect(mockOnQueueEnded).toHaveBeenCalled();
    });

    it("RemoteDuck calls Coordinator.onRemoteDuck", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-duck");
      expect(handler).toBeDefined();

      const args = { paused: true, permanent: false };
      handler!(args);

      expect(mockOnRemoteDuck).toHaveBeenCalled();
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

    it("RemotePause pauses playback, seeks back, and calls Coordinator.onPause", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-pause");
      expect(handler).toBeDefined();

      await handler!();

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(mockSeekImmediateNoLog).toHaveBeenCalledWith(-1);
      expect(mockOnPause).toHaveBeenCalled();
    });

    it("RemotePlay starts playback and calls Coordinator.onPlay", async () => {
      await PlaybackService();

      const handler = getEventHandler("remote-play");
      expect(handler).toBeDefined();

      await handler!();

      expect(mockTrackPlayerPlay).toHaveBeenCalled();
      expect(mockOnPlay).toHaveBeenCalled();
    });
  });
});
