/* eslint-disable import/first */
// Mock service dependencies
const mockRecordPlayEvent = jest.fn();
const mockRecordPauseEvent = jest.fn();
jest.mock("@/services/event-recording", () => ({
  recordPlayEvent: (...args: unknown[]) => mockRecordPlayEvent(...args),
  recordPauseEvent: (...args: unknown[]) => mockRecordPauseEvent(...args),
}));

const mockHeartbeatStart = jest.fn();
const mockHeartbeatStop = jest.fn();
jest.mock("@/services/position-heartbeat", () => ({
  start: (...args: unknown[]) => mockHeartbeatStart(...args),
  stop: (...args: unknown[]) => mockHeartbeatStop(...args),
}));

const mockLifecycleFinish = jest.fn();
jest.mock("@/services/playthrough-lifecycle", () => ({
  finishPlaythrough: (...args: unknown[]) => mockLifecycleFinish(...args),
}));

const mockSleepTimerReset = jest.fn();
const mockSleepTimerCancel = jest.fn();
const mockSleepTimerStartMonitoring = jest.fn();
jest.mock("@/services/sleep-timer-service", () => ({
  reset: (...args: unknown[]) => mockSleepTimerReset(...args),
  cancel: (...args: unknown[]) => mockSleepTimerCancel(...args),
  startMonitoring: (...args: unknown[]) =>
    mockSleepTimerStartMonitoring(...args),
}));

// Mock store dependencies
const mockUsePlayerUIState = {
  loadedPlaythrough: {
    playthroughId: "test-playthrough-id",
    mediaId: "test-media-id",
  },
  playbackRate: 1.25,
};
jest.mock("@/stores/player-ui-state", () => ({
  usePlayerUIState: {
    getState: () => mockUsePlayerUIState,
  },
}));

const mockUseSession = {
  session: { url: "http://test.com", email: "test@test.com", token: "token" },
};
jest.mock("@/stores/session", () => ({
  useSession: {
    getState: () => mockUseSession,
  },
}));

// Mock DB dependencies
const mockSyncPlaythroughs = jest.fn().mockResolvedValue(undefined);
jest.mock("@/db/sync", () => ({
  syncPlaythroughs: (...args: unknown[]) => mockSyncPlaythroughs(...args),
}));

// Mock device store
const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
jest.mock("@/stores/device", () => ({
  initializeDevice: (...args: unknown[]) => mockInitializeDevice(...args),
}));

// Mock seek service
const mockSeekRelative = jest.fn();
const mockSeekImmediateNoLog = jest.fn().mockResolvedValue(undefined);
jest.mock("@/services/seek-service", () => ({
  seekRelative: (...args: unknown[]) => mockSeekRelative(...args),
  seekImmediateNoLog: (...args: unknown[]) => mockSeekImmediateNoLog(...args),
  SeekSource: {
    REMOTE: "remote",
  },
}));

import { PlaybackService } from "@/services/playback-service";
import {
  mockTrackPlayerAddEventListener,
  mockTrackPlayerGetProgress,
  mockTrackPlayerGetRate,
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
    jest.clearAllMocks();
    mockTrackPlayerGetProgress.mockResolvedValue({
      position: 100,
      duration: 1000,
    });
    mockTrackPlayerGetRate.mockResolvedValue(1.25);
  });

  describe("PlaybackService initialization", () => {
    it("registers TrackPlayer event listeners", async () => {
      await PlaybackService();
      expect(mockTrackPlayerAddEventListener).toHaveBeenCalled();
      const registeredEvents = mockTrackPlayerAddEventListener.mock.calls.map(
        (call) => call[0],
      );
      expect(registeredEvents).toContain("playback-queue-ended");
      expect(registeredEvents).toContain("remote-duck");
      expect(registeredEvents).toContain("remote-jump-backward");
      expect(registeredEvents).toContain("remote-jump-forward");
      expect(registeredEvents).toContain("remote-pause");
      expect(registeredEvents).toContain("remote-play");
    });

    it("initializes device store and sleep timer", async () => {
      await PlaybackService();
      expect(mockInitializeDevice).toHaveBeenCalled();
      expect(mockSleepTimerStartMonitoring).toHaveBeenCalled();
    });
  });

  describe("event handlers", () => {
    it("PlaybackQueueEnded calls the correct services", async () => {
      await PlaybackService();
      const handler = getEventHandler("playback-queue-ended");
      expect(handler).toBeDefined();

      await handler!();

      expect(mockHeartbeatStop).toHaveBeenCalled();
      expect(mockRecordPauseEvent).toHaveBeenCalledWith(
        "test-playthrough-id",
        1000, // duration
        1.25, // playbackRate
      );
      expect(mockLifecycleFinish).toHaveBeenCalledWith(
        null,
        "test-playthrough-id",
      );
      expect(mockSleepTimerCancel).toHaveBeenCalled();
    });

    it("RemoteDuck calls SleepTimer.reset", async () => {
      await PlaybackService();
      const handler = getEventHandler("remote-duck");
      expect(handler).toBeDefined();

      const args = { paused: true, permanent: false };
      handler!(args);

      expect(mockSleepTimerReset).toHaveBeenCalled();
    });

    it("RemoteJumpBackward calls seekRelative with negative interval", async () => {
      await PlaybackService();
      const handler = getEventHandler("remote-jump-backward");
      expect(handler).toBeDefined();

      handler!({ interval: 30 });

      expect(mockSeekRelative).toHaveBeenCalledWith(-30, "remote");
    });

    it("RemoteJumpForward calls seekRelative with positive interval", async () => {
      await PlaybackService();
      const handler = getEventHandler("remote-jump-forward");
      expect(handler).toBeDefined();

      handler!({ interval: 30 });

      expect(mockSeekRelative).toHaveBeenCalledWith(30, "remote");
    });

    it("RemotePause calls the correct services", async () => {
      await PlaybackService();
      const handler = getEventHandler("remote-pause");
      expect(handler).toBeDefined();

      await handler!();

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(mockSeekImmediateNoLog).toHaveBeenCalledWith(-1);
      expect(mockHeartbeatStop).toHaveBeenCalled();
      expect(mockRecordPauseEvent).toHaveBeenCalledWith(
        "test-playthrough-id",
        100, // position
        1.25, // playbackRate
      );
      expect(mockSleepTimerCancel).toHaveBeenCalled();
      expect(mockSyncPlaythroughs).toHaveBeenCalled();
    });

    it("RemotePlay calls the correct services", async () => {
      await PlaybackService();
      const handler = getEventHandler("remote-play");
      expect(handler).toBeDefined();

      await handler!();

      expect(mockTrackPlayerPlay).toHaveBeenCalled();
      expect(mockRecordPlayEvent).toHaveBeenCalledWith(
        "test-playthrough-id",
        100, // position
        1.25, // rate
      );
      expect(mockHeartbeatStart).toHaveBeenCalledWith(
        "test-playthrough-id",
        1.25,
      );
      expect(mockSleepTimerReset).toHaveBeenCalled();
    });
  });
});
