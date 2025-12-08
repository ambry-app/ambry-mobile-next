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
jest.mock("@/utils/seek", () => ({
  seek: jest.fn(),
  seekImmediateNoLog: jest.fn().mockResolvedValue(undefined),
}));

import * as EventRecording from "@/services/event-recording-service";
import { PlaybackService } from "@/services/playback-service";
import * as ProgressSave from "@/services/progress-save-service";
import * as SleepTimer from "@/services/sleep-timer-service";
import { mockTrackPlayerAddEventListener } from "@test/jest-setup";
/* eslint-enable import/first */

describe("playback-service", () => {
  beforeEach(() => {
    mockTrackPlayerAddEventListener.mockReset();
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
});
