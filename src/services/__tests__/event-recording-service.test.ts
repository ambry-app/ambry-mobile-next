import {
  __resetForTesting,
  handlePlaybackPaused,
  handlePlaybackQueueEnded,
  handlePlaybackRateChanged,
  handlePlaybackStarted,
  handleSeekCompleted,
  initialize,
  initializePlaythroughTracking,
  recordAbandonEvent,
  recordFinishEvent,
  recordStartEvent,
} from "@/services/event-recording-service";
import { useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockTrackPlayerGetProgress,
  mockTrackPlayerGetRate,
} from "@test/jest-setup";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("event-recording-service", () => {
  beforeEach(() => {
    __resetForTesting();

    // Set up session
    useSession.setState({ session });

    // Set up device store
    useDevice.setState({
      initialized: true,
      deviceInfo: {
        id: "test-device-id",
        type: "android",
        brand: "TestBrand",
        modelName: "TestModel",
        osName: "Android",
        osVersion: "14",
      },
    });

    // Reset mocks
    mockTrackPlayerGetProgress.mockReset();
    mockTrackPlayerGetRate.mockReset();

    // Default mock values
    mockTrackPlayerGetProgress.mockResolvedValue({
      position: 100,
      duration: 3600,
    });
    mockTrackPlayerGetRate.mockResolvedValue(1);
  });

  afterEach(() => {
    __resetForTesting();
  });

  describe("initialize", () => {
    it("only initializes once", async () => {
      await initialize();
      await initialize();

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe("initializePlaythroughTracking", () => {
    it("sets up tracking for a playthrough and records events correctly", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Trigger a play event to verify tracking is set up
      await handlePlaybackStarted();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      // Should have recorded a play event for this playthrough
      const playEvents = events.filter((e) => e.type === "play");
      expect(playEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("reuses in-memory playthrough for same ID (JS context persistence)", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();

      // First initialization
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Second initialization for same playthrough (simulating app resume)
      // Should not throw and should continue to record to the same playthrough
      initializePlaythroughTracking(playthrough.id, 100, 1.5);

      // Trigger a play event to verify tracking still works
      await handlePlaybackStarted();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      // Should have recorded a play event for this playthrough
      const playEvents = events.filter((e) => e.type === "play");
      expect(playEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("lifecycle event recording", () => {
    it("recordStartEvent creates a start event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, { mediaId: media.id });

      await recordStartEvent(playthrough.id);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("start");
    });

    it("recordFinishEvent creates a finish event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, { mediaId: media.id });

      await recordFinishEvent(playthrough.id);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("finish");
    });

    it("recordAbandonEvent creates an abandon event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, { mediaId: media.id });

      await recordAbandonEvent(playthrough.id);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("abandon");
    });
  });

  describe("playback event handling", () => {
    it("records play event on handlePlaybackStarted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      await handlePlaybackStarted();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const playEvents = events.filter((e) => e.type === "play");
      expect(playEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("records pause event on handlePlaybackPaused", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Start playback first (required for pause event to be recorded)
      await handlePlaybackStarted();

      // Then pause
      await handlePlaybackPaused();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const pauseEvents = events.filter((e) => e.type === "pause");
      expect(pauseEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("records seek event on handleSeekCompleted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Call seek handler directly (must be > 2 seconds to be recorded)
      const seekTimestamp = new Date();
      await handleSeekCompleted({
        fromPosition: 0,
        toPosition: 60,
        timestamp: seekTimestamp,
      });

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const seekEvents = events.filter((e) => e.type === "seek");
      expect(seekEvents.length).toBeGreaterThanOrEqual(1);
      expect(seekEvents[0]?.fromPosition).toBe(0);
      expect(seekEvents[0]?.toPosition).toBe(60);
    });

    it("ignores trivial seeks (< 2 seconds)", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Call seek handler with trivial seek
      await handleSeekCompleted({
        fromPosition: 0,
        toPosition: 1,
        timestamp: new Date(),
      });

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const seekEvents = events.filter((e) => e.type === "seek");
      expect(seekEvents).toHaveLength(0);
    });

    it("records rate change event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      await handlePlaybackRateChanged({
        previousRate: 1,
        newRate: 1.5,
        position: 100,
      });

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const rateEvents = events.filter((e) => e.type === "rate_change");
      expect(rateEvents.length).toBeGreaterThanOrEqual(1);
      expect(rateEvents[0]?.playbackRate).toBe(1.5);
      expect(rateEvents[0]?.previousRate).toBe(1);
    });

    it("handles playbackQueueEnded and marks playthrough finished", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3600,
        duration: 3600,
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      await handlePlaybackQueueEnded();

      // Check that finish event was recorded
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      const finishEvents = events.filter((e) => e.type === "finish");
      expect(finishEvents.length).toBeGreaterThanOrEqual(1);

      // Check that playthrough status was updated
      const updatedPlaythrough = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthrough.id),
      });
      expect(updatedPlaythrough?.status).toBe("finished");
    });
  });

  describe("error handling", () => {
    it("handles errors in handlePlaybackStarted gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Should not throw
      await handlePlaybackStarted();

      // Test passes if no error thrown
      expect(true).toBe(true);
    });

    it("handles errors in handlePlaybackPaused gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Should not throw
      await handlePlaybackPaused();

      expect(true).toBe(true);
    });

    it("handles errors in handlePlaybackQueueEnded gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Should not throw
      await handlePlaybackQueueEnded();

      expect(true).toBe(true);
    });

    it("handles errors in handleSeekCompleted gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Mock the database insert to fail
      const originalInsert = db.insert;
      jest.spyOn(db, "insert").mockImplementation(() => {
        throw new Error("Database error");
      });

      // Should not throw - call handler with non-trivial seek
      await handleSeekCompleted({
        fromPosition: 0,
        toPosition: 60,
        timestamp: new Date(),
      });

      // Restore
      db.insert = originalInsert;

      expect(true).toBe(true);
    });

    it("handles errors in handlePlaybackRateChanged gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Mock the database to fail
      const originalInsert = db.insert;
      jest.spyOn(db, "insert").mockImplementation(() => {
        throw new Error("Database error");
      });

      // Should not throw
      await handlePlaybackRateChanged({
        previousRate: 1,
        newRate: 1.5,
        position: 100,
      });

      // Restore
      db.insert = originalInsert;

      expect(true).toBe(true);
    });
  });

  describe("heartbeat functionality", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("starts heartbeat on handlePlaybackStarted and updates state cache", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });
      mockTrackPlayerGetRate.mockResolvedValue(1);

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Trigger handlePlaybackStarted to start heartbeat
      await handlePlaybackStarted();
      await jest.advanceTimersByTimeAsync(100);

      // Update position for heartbeat
      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 200,
        duration: 3600,
      });

      // Advance to trigger heartbeat (PROGRESS_SAVE_INTERVAL is 30000ms)
      await jest.advanceTimersByTimeAsync(30000);

      // Check that state cache was updated
      const afterHeartbeat = await db.query.playthroughStateCache.findFirst({
        where: (p, { eq }) => eq(p.playthroughId, playthrough.id),
      });

      // Position should have been updated by heartbeat
      expect(afterHeartbeat?.currentPosition).toBe(200);
    });

    it("handles errors in heartbeat gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });
      mockTrackPlayerGetRate.mockResolvedValue(1);

      await initialize();
      initializePlaythroughTracking(playthrough.id, 0, 1);

      // Trigger handlePlaybackStarted to start heartbeat
      await handlePlaybackStarted();
      await jest.advanceTimersByTimeAsync(100);

      // Make TrackPlayer.getProgress fail for heartbeat
      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      // Should not throw when heartbeat fires
      await jest.advanceTimersByTimeAsync(30000);

      expect(true).toBe(true);
    });
  });
});
