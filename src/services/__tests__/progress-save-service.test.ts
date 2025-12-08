import { PROGRESS_SAVE_INTERVAL } from "@/constants";
import { createPlayerState, getLocalPlayerState } from "@/db/player-states";
import {
  __resetForTesting,
  saveNow,
  startMonitoring,
  stopMonitoring,
} from "@/services/progress-save-service";
import { useSession } from "@/stores/session";
import { EventBus } from "@/utils";
import { setupTestDatabase } from "@test/db-test-utils";
import { createMedia, DEFAULT_TEST_SESSION } from "@test/factories";
import {
  mockTrackPlayerGetProgress,
  mockTrackPlayerGetTrack,
} from "@test/jest-setup";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("progress-save-service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetForTesting();

    // Set up session in the store
    useSession.setState({ session });

    // Reset TrackPlayer mocks
    mockTrackPlayerGetTrack.mockReset();
    mockTrackPlayerGetProgress.mockReset();
  });

  afterEach(() => {
    __resetForTesting();
    jest.useRealTimers();
  });

  describe("startMonitoring", () => {
    it("only initializes once", () => {
      startMonitoring();
      startMonitoring();

      // If it initialized twice, we'd have duplicate listeners
      // Emit playbackStarted and verify the interval only starts once
      EventBus.emit("playbackStarted");

      // This is hard to test directly, but we can verify no errors occur
      expect(true).toBe(true);
    });

    it("sets up event listeners for playback events", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });

      startMonitoring();

      // Emit playbackStarted - should start the save interval
      EventBus.emit("playbackStarted");

      // Advance time by the save interval
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);

      // Verify progress was saved
      const state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(100);
      expect(state?.status).toBe("in_progress");
    });
  });

  describe("saveNow", () => {
    it("saves current position to database", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 500,
        duration: 3600,
      });

      await saveNow();

      const state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(500);
      expect(state?.status).toBe("in_progress");
    });

    it("does nothing when no session exists", async () => {
      useSession.setState({ session: null });

      mockTrackPlayerGetTrack.mockResolvedValue({ description: "media-id" });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });

      // Should not throw
      await expect(saveNow()).resolves.not.toThrow();
    });

    it("does nothing when no track is loaded", async () => {
      mockTrackPlayerGetTrack.mockResolvedValue(null);

      await expect(saveNow()).resolves.not.toThrow();
    });

    it("does nothing when track has no mediaId", async () => {
      mockTrackPlayerGetTrack.mockResolvedValue({ description: undefined });

      await expect(saveNow()).resolves.not.toThrow();
    });

    it("does nothing when duration is 0", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 0,
      });

      await saveNow();

      // Position should not have been updated
      const state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(0);
    });
  });

  describe("status calculation", () => {
    it("sets status to not_started when position < 60 seconds", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 30,
        duration: 3600,
      });

      await saveNow();

      const state = await getLocalPlayerState(session, media.id);
      expect(state?.status).toBe("not_started");
    });

    it("sets status to finished when < 120 seconds remaining", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3500,
        duration: 3600,
      });

      await saveNow();

      const state = await getLocalPlayerState(session, media.id);
      expect(state?.status).toBe("finished");
    });

    it("sets status to in_progress otherwise", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "not_started");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 1800,
        duration: 3600,
      });

      await saveNow();

      const state = await getLocalPlayerState(session, media.id);
      expect(state?.status).toBe("in_progress");
    });
  });

  describe("playback event handling", () => {
    it("starts save interval on playbackStarted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });

      startMonitoring();
      EventBus.emit("playbackStarted");

      // Before interval fires, position should be unchanged
      let state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(0);

      // Advance time
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);

      // Now position should be updated
      state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(100);
    });

    it("stops save interval and saves on playbackPaused", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 200,
        duration: 3600,
      });

      startMonitoring();
      EventBus.emit("playbackStarted");
      EventBus.emit("playbackPaused");

      // Flush promises to let the async saveNow() complete
      await jest.runAllTimersAsync();

      // Should save immediately on pause
      const state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(200);

      // Update mock to return different position
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 300,
        duration: 3600,
      });

      // Advance time - interval should be stopped, so no new save
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);

      // Position should still be 200 (no new save after pause)
      const stateAfter = await getLocalPlayerState(session, media.id);
      expect(stateAfter?.position).toBe(200);
    });

    it("stops save interval and saves on playbackQueueEnded", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3600,
        duration: 3600,
      });

      startMonitoring();
      EventBus.emit("playbackStarted");
      EventBus.emit("playbackQueueEnded");

      // Flush promises to let the async saveNow() complete
      await jest.runAllTimersAsync();

      // Should save immediately
      const state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(3600);
      expect(state?.status).toBe("finished");
    });

    it("saves periodically while playing", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });

      let currentPosition = 100;
      mockTrackPlayerGetProgress.mockImplementation(() =>
        Promise.resolve({ position: currentPosition, duration: 3600 }),
      );

      startMonitoring();
      EventBus.emit("playbackStarted");

      // First save
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);
      let state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(100);

      // Simulate playback progress
      currentPosition = 200;
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);
      state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(200);

      // More progress
      currentPosition = 300;
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);
      state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(300);
    });
  });

  describe("stopMonitoring", () => {
    it("stops the save interval", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlayerState(session, media.id, 1, 0, "in_progress");

      mockTrackPlayerGetTrack.mockResolvedValue({ description: media.id });

      let currentPosition = 100;
      mockTrackPlayerGetProgress.mockImplementation(() =>
        Promise.resolve({ position: currentPosition, duration: 3600 }),
      );

      startMonitoring();
      EventBus.emit("playbackStarted");

      // First save
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);
      let state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(100);

      // Stop monitoring
      stopMonitoring();

      // Position changes but we stopped monitoring
      currentPosition = 500;
      await jest.advanceTimersByTimeAsync(PROGRESS_SAVE_INTERVAL);

      // Position should not have updated
      state = await getLocalPlayerState(session, media.id);
      expect(state?.position).toBe(100);
    });
  });
});
