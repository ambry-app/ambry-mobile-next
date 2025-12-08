import {
  __resetForTesting,
  getCurrentPlaythroughId,
  initializePlaythroughTracking,
  recordAbandonEvent,
  recordFinishEvent,
  recordStartEvent,
  startMonitoring,
} from "@/services/event-recording-service";
import { useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { EventBus } from "@/utils";
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

  describe("startMonitoring", () => {
    it("only initializes once", async () => {
      await startMonitoring();
      await startMonitoring();

      // No errors should occur
      expect(true).toBe(true);
    });

    it("sets up event listeners", async () => {
      await startMonitoring();

      // Verify listeners are registered by checking EventBus has listeners
      expect(EventBus.listenerCount("playbackStarted")).toBeGreaterThan(0);
      expect(EventBus.listenerCount("playbackPaused")).toBeGreaterThan(0);
      expect(EventBus.listenerCount("playbackQueueEnded")).toBeGreaterThan(0);
      expect(EventBus.listenerCount("seekCompleted")).toBeGreaterThan(0);
      expect(EventBus.listenerCount("playbackRateChanged")).toBeGreaterThan(0);
    });
  });

  describe("initializePlaythroughTracking", () => {
    it("creates a new playthrough when none exists", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Should have created a playthrough
      const playthroughId = getCurrentPlaythroughId();
      expect(playthroughId).not.toBeNull();

      // Verify playthrough exists in database
      const playthrough = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthroughId!),
      });
      expect(playthrough).toBeDefined();
      expect(playthrough?.mediaId).toBe(media.id);
    });

    it("reuses existing active playthrough", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const existingPlaythrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Should use the existing playthrough
      expect(getCurrentPlaythroughId()).toBe(existingPlaythrough.id);
    });

    it("reuses in-memory playthrough for same media (JS context persistence)", async () => {
      const db = getDb();
      const media = await createMedia(db);

      // First initialization
      await initializePlaythroughTracking(session, media.id, 0, 1);
      const firstPlaythroughId = getCurrentPlaythroughId();

      // Second initialization for same media (simulating app resume)
      await initializePlaythroughTracking(session, media.id, 100, 1.5);

      // Should keep the same playthrough
      expect(getCurrentPlaythroughId()).toBe(firstPlaythroughId);
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
    it("records play event on playbackStarted", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      EventBus.emit("playbackStarted");
      // Wait for async handler to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      // Should have start event (from initialization) + play event
      const playEvents = events.filter((e) => e.type === "play");
      expect(playEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("records pause event on playbackPaused", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      EventBus.emit("playbackPaused");
      await Promise.resolve();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      const pauseEvents = events.filter((e) => e.type === "pause");
      expect(pauseEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("records seek event on seekCompleted", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      // Emit seek event (must be > 2 seconds to be recorded)
      EventBus.emit("seekCompleted", { fromPosition: 0, toPosition: 60 });
      await Promise.resolve();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      const seekEvents = events.filter((e) => e.type === "seek");
      expect(seekEvents.length).toBeGreaterThanOrEqual(1);
      expect(seekEvents[0]?.fromPosition).toBe(0);
      expect(seekEvents[0]?.toPosition).toBe(60);
    });

    it("ignores trivial seeks (< 2 seconds)", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      // Emit trivial seek
      EventBus.emit("seekCompleted", { fromPosition: 0, toPosition: 1 });
      await Promise.resolve();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      const seekEvents = events.filter((e) => e.type === "seek");
      expect(seekEvents).toHaveLength(0);
    });

    it("records rate change event", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      EventBus.emit("playbackRateChanged", {
        previousRate: 1,
        newRate: 1.5,
        position: 100,
      });
      await Promise.resolve();

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      const rateEvents = events.filter((e) => e.type === "rate_change");
      expect(rateEvents.length).toBeGreaterThanOrEqual(1);
      expect(rateEvents[0]?.playbackRate).toBe(1.5);
      expect(rateEvents[0]?.previousRate).toBe(1);
    });

    it("handles playbackQueueEnded and marks playthrough finished", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 3600,
        duration: 3600,
      });

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      EventBus.emit("playbackQueueEnded");
      // Wait for async handler to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that finish event was recorded
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthroughId),
      });

      const finishEvents = events.filter((e) => e.type === "finish");
      expect(finishEvents.length).toBeGreaterThanOrEqual(1);

      // Check that playthrough status was updated
      const playthrough = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthroughId),
      });
      expect(playthrough?.status).toBe("finished");
    });
  });

  describe("error handling", () => {
    it("handles errors in playbackStarted gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Should not throw
      EventBus.emit("playbackStarted");
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Test passes if no error thrown
      expect(true).toBe(true);
    });

    it("handles errors in playbackPaused gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Should not throw
      EventBus.emit("playbackPaused");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(true).toBe(true);
    });

    it("handles errors in playbackQueueEnded gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockRejectedValue(
        new Error("TrackPlayer error"),
      );

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Should not throw
      EventBus.emit("playbackQueueEnded");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(true).toBe(true);
    });

    it("handles errors in seekCompleted gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Mock the database insert to fail
      const originalInsert = db.insert;
      jest.spyOn(db, "insert").mockImplementation(() => {
        throw new Error("Database error");
      });

      // Should not throw - emit a non-trivial seek to trigger recordSeekEvent
      EventBus.emit("seekCompleted", { fromPosition: 0, toPosition: 60 });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Restore
      db.insert = originalInsert;

      expect(true).toBe(true);
    });

    it("handles errors in playbackRateChanged gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Mock the database to fail
      const originalInsert = db.insert;
      jest.spyOn(db, "insert").mockImplementation(() => {
        throw new Error("Database error");
      });

      // Should not throw
      EventBus.emit("playbackRateChanged", {
        previousRate: 1,
        newRate: 1.5,
        position: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Restore
      db.insert = originalInsert;

      expect(true).toBe(true);
    });

    it("handles errors in initializePlaythroughTracking gracefully", async () => {
      // Set up session but make database operations fail
      const db = getDb();
      const originalQuery = db.query;
      Object.defineProperty(db, "query", {
        get: () => {
          throw new Error("Database error");
        },
        configurable: true,
      });

      // Should not throw
      await expect(
        initializePlaythroughTracking(session, "non-existent-media", 0, 1),
      ).resolves.not.toThrow();

      // Restore
      Object.defineProperty(db, "query", {
        value: originalQuery,
        configurable: true,
      });
    });
  });

  describe("heartbeat functionality", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("starts heartbeat on playbackStarted and updates state cache", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });
      mockTrackPlayerGetRate.mockResolvedValue(1);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      const playthroughId = getCurrentPlaythroughId()!;

      // Trigger playbackStarted to start heartbeat
      EventBus.emit("playbackStarted");
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
        where: (p, { eq }) => eq(p.playthroughId, playthroughId),
      });

      // Position should have been updated by heartbeat
      expect(afterHeartbeat?.currentPosition).toBe(200);
    });

    it("handles errors in heartbeat gracefully", async () => {
      const db = getDb();
      const media = await createMedia(db);

      mockTrackPlayerGetProgress.mockResolvedValue({
        position: 100,
        duration: 3600,
      });
      mockTrackPlayerGetRate.mockResolvedValue(1);

      await startMonitoring();
      await initializePlaythroughTracking(session, media.id, 0, 1);

      // Trigger playbackStarted to start heartbeat
      EventBus.emit("playbackStarted");
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

  describe("getCurrentPlaythroughId", () => {
    it("returns null when no playthrough is set", () => {
      expect(getCurrentPlaythroughId()).toBeNull();
    });

    it("returns the current playthrough ID after initialization", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await initializePlaythroughTracking(session, media.id, 0, 1);

      expect(getCurrentPlaythroughId()).not.toBeNull();
    });
  });
});
