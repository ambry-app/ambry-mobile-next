/**
 * Tests for event-recording.ts
 *
 * Uses Detroit-style testing:
 * - Real database (test in-memory SQLite)
 * - Real stores (zustand)
 * - Fake timers for debounce control
 *
 * Tests both:
 * - Direct lifecycle event recording (recordStartEvent, etc.)
 * - Automatic event recording via store subscriptions
 */

import {
  PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW,
  RATE_CHANGE_EVENT_ACCUMULATION_WINDOW,
  SEEK_EVENT_ACCUMULATION_WINDOW,
} from "@/constants";
import * as eventRecording from "@/services/event-recording";
import {
  resetForTesting as resetDeviceStore,
  useDevice,
} from "@/stores/device";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import {
  PlayPauseSource,
  PlayPauseType,
  resetForTesting as resetTrackPlayerStore,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { installFetchMock, mockGraphQL } from "@test/fetch-mock";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to query all playback events from the database.
 */
async function getAllPlaybackEvents() {
  const db = getDb();
  return db.query.playbackEvents.findMany({
    orderBy: (e, { asc }) => asc(e.timestamp),
  });
}

/**
 * Helper to set up session and device stores for event recording.
 */
function setupSessionAndDevice() {
  useSession.setState({ session });
  useDevice.setState({
    initialized: true,
    deviceInfo: {
      id: "test-device-id",
      type: "android",
      brand: "TestBrand",
      modelName: "TestModel",
      osName: "TestOS",
      osVersion: "1.0.0",
      appId: "app.ambry.mobile.dev",
      appVersion: "1.0.0",
      appBuild: "1",
    },
  });
}

describe("event-recording", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTrackPlayerStore();
    resetSessionStore();
    resetDeviceStore();
    setupSessionAndDevice();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("lifecycle events", () => {
    it("records start event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      await eventRecording.recordStartEvent(playthrough.id);

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("start");
      expect(events[0]!.playthroughId).toBe(playthrough.id);
      expect(events[0]!.deviceId).toBe("test-device-id");
    });

    it("records finish event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      await eventRecording.recordFinishEvent(playthrough.id);

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("finish");
      expect(events[0]!.playthroughId).toBe(playthrough.id);
    });

    it("records abandon event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      await eventRecording.recordAbandonEvent(playthrough.id);

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("abandon");
      expect(events[0]!.playthroughId).toBe(playthrough.id);
    });

    it("records resume event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      await eventRecording.recordResumeEvent(playthrough.id);

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("resume");
      expect(events[0]!.playthroughId).toBe(playthrough.id);
    });
  });

  describe("play/pause event recording via store", () => {
    beforeEach(async () => {
      // Initialize event recording to set up store subscriptions
      await eventRecording.initialize();
    });

    it("records play event after debounce window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      // Simulate a play event by setting lastPlayPause in the store
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PLAY,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      // Before timer fires, no event should be recorded
      const eventsBefore = await getAllPlaybackEvents();
      expect(eventsBefore).toHaveLength(0);

      // Advance past debounce window
      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("play");
      expect(events[0]!.position).toBe(50);
      expect(events[0]!.playbackRate).toBe(1.0);
    });

    it("records pause event after debounce window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });
      // Mock fetch for sync (called on pause)
      const mockFetch = installFetchMock();
      mockGraphQL(mockFetch, {
        data: { syncProgress: { playthroughs: [], events: [] } },
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PAUSE,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 75,
          playbackRate: 1.5,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("pause");
      expect(events[0]!.position).toBe(75);
      expect(events[0]!.playbackRate).toBe(1.5);
    });

    it("ignores INTERNAL source events", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PLAY,
          source: PlayPauseSource.INTERNAL,
          playthroughId: playthrough.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });

    it("cancels if toggled back to original state within window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      // First: pause
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PAUSE,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      // Advance partway
      jest.advanceTimersByTime(PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW / 2);

      // Then: play (back to original state - was playing before pause)
      useTrackPlayer.setState({
        lastPlayPause: {
          type: PlayPauseType.PLAY,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      // Should have cancelled - toggled back to original state
      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("rate change event recording via store", () => {
    beforeEach(async () => {
      await eventRecording.initialize();
    });

    it("records rate change event after debounce window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastRateChange: {
          previousRate: 1.0,
          newRate: 1.5,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("rate_change");
      expect(events[0]!.previousRate).toBe(1.0);
      expect(events[0]!.playbackRate).toBe(1.5);
      expect(events[0]!.position).toBe(100);
    });

    it("accumulates rate changes and records first-to-last", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      // Change from 1.0 to 1.25
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastRateChange: {
          previousRate: 1.0,
          newRate: 1.25,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      jest.advanceTimersByTime(RATE_CHANGE_EVENT_ACCUMULATION_WINDOW / 2);

      // Change from 1.25 to 1.5
      useTrackPlayer.setState({
        lastRateChange: {
          previousRate: 1.25,
          newRate: 1.5,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      jest.advanceTimersByTime(RATE_CHANGE_EVENT_ACCUMULATION_WINDOW / 2);

      // Change from 1.5 to 2.0
      useTrackPlayer.setState({
        lastRateChange: {
          previousRate: 1.5,
          newRate: 2.0,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      // Should record single event: 1.0 -> 2.0
      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.previousRate).toBe(1.0);
      expect(events[0]!.playbackRate).toBe(2.0);
    });

    it("skips if rate returns to original within window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      // Change from 1.0 to 1.5
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastRateChange: {
          previousRate: 1.0,
          newRate: 1.5,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      jest.advanceTimersByTime(RATE_CHANGE_EVENT_ACCUMULATION_WINDOW / 2);

      // Change back from 1.5 to 1.0
      useTrackPlayer.setState({
        lastRateChange: {
          previousRate: 1.5,
          newRate: 1.0,
          playthroughId: playthrough.id,
          position: 100,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      // Should be skipped - rate returned to original
      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("seek event recording via store", () => {
    beforeEach(async () => {
      await eventRecording.initialize();
    });

    it("records seek event after debounce window", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastSeek: {
          from: 50,
          to: 150,
          source: SeekSource.SCRUBBER,
          playthroughId: playthrough.id,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("seek");
      expect(events[0]!.fromPosition).toBe(50);
      expect(events[0]!.toPosition).toBe(150);
      expect(events[0]!.position).toBe(150);
    });

    it("accumulates seeks and records first-from to last-to", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      // First seek: 50 -> 100
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastSeek: {
          from: 50,
          to: 100,
          source: SeekSource.BUTTON,
          playthroughId: playthrough.id,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      jest.advanceTimersByTime(SEEK_EVENT_ACCUMULATION_WINDOW / 2);

      // Second seek: 100 -> 200
      useTrackPlayer.setState({
        lastSeek: {
          from: 100,
          to: 200,
          source: SeekSource.BUTTON,
          playthroughId: playthrough.id,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      // Should record single event: 50 -> 200
      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.fromPosition).toBe(50);
      expect(events[0]!.toPosition).toBe(200);
    });

    it("ignores INTERNAL source seeks", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastSeek: {
          from: 50,
          to: 150,
          source: SeekSource.INTERNAL,
          playthroughId: playthrough.id,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });

    it("skips trivial seeks (< 2 seconds)", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastSeek: {
          from: 50,
          to: 51, // Only 1 second difference
          source: SeekSource.SCRUBBER,
          playthroughId: playthrough.id,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("flushing on playthrough change", () => {
    beforeEach(async () => {
      await eventRecording.initialize();
    });

    it("flushes pending events when playthrough changes", async () => {
      const db = getDb();
      // Don't create start events - we're testing event recording directly
      const playthrough1 = await createPlaythrough(db, {
        createStartEvent: false,
      });
      const media2 = await createMedia(db);
      const playthrough2 = await createPlaythrough(db, {
        mediaId: media2.id,
        createStartEvent: false,
      });
      // Mock fetch for sync
      const mockFetch = installFetchMock();
      mockGraphQL(mockFetch, {
        data: { syncProgress: { playthroughs: [], events: [] } },
      });

      // Start recording a pause event for playthrough1
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough1.id,
          mediaId: playthrough1.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PAUSE,
          source: PlayPauseSource.USER,
          playthroughId: playthrough1.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      // Partway through debounce window
      jest.advanceTimersByTime(PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW / 2);

      // Switch to playthrough2 - should flush playthrough1's event
      useTrackPlayer.setState({
        playthrough: {
          id: playthrough2.id,
          mediaId: playthrough2.mediaId,
          status: "in_progress",
        },
      });

      // Allow flush to complete
      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.playthroughId).toBe(playthrough1.id);
      expect(events[0]!.type).toBe("pause");
    });
  });

  describe("state cache updates", () => {
    beforeEach(async () => {
      await eventRecording.initialize();
    });

    it("updates state cache when recording play event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PLAY,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 123,
          playbackRate: 1.5,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const cache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(cache).not.toBeNull();
      expect(cache!.position).toBe(123);
    });

    it("updates state cache when recording seek event", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastSeek: {
          from: 50,
          to: 200,
          source: SeekSource.SCRUBBER,
          playthroughId: playthrough.id,
          playbackRate: 1.25,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const cache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(cache).not.toBeNull();
      expect(cache!.position).toBe(200);
    });
  });

  describe("no session", () => {
    beforeEach(async () => {
      await eventRecording.initialize();
      // Clear session
      useSession.setState({ session: null });
    });

    it("does not record events when no session", async () => {
      const db = getDb();
      // Don't create start event - we're testing event recording directly
      const playthrough = await createPlaythrough(db, {
        createStartEvent: false,
      });

      useTrackPlayer.setState({
        playthrough: {
          id: playthrough.id,
          mediaId: playthrough.mediaId,
          status: "in_progress",
        },
        lastPlayPause: {
          type: PlayPauseType.PLAY,
          source: PlayPauseSource.USER,
          playthroughId: playthrough.id,
          position: 50,
          playbackRate: 1.0,
          timestamp: Date.now(),
        },
      });

      await jest.runAllTimersAsync();

      const events = await getAllPlaybackEvents();
      expect(events).toHaveLength(0);
    });
  });
});
