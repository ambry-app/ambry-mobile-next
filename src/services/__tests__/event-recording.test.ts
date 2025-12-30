/**
 * Tests for the pure event-recording module.
 *
 * Testing philosophy: Use real implementations wherever possible.
 * These tests verify that events are correctly recorded to the database.
 */

import {
  recordAbandonEvent,
  recordFinishEvent,
  recordPauseEvent,
  recordPlayEvent,
  recordRateChangeEvent,
  recordResumeEvent,
  recordSeekEvent,
  recordStartEvent,
} from "@/services/event-recording";
import { useDevice } from "@/stores/device";
import { useSession } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("event-recording", () => {
  beforeEach(() => {
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
  });

  describe("playback events", () => {
    it("recordPlayEvent inserts a play event and updates state cache", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await recordPlayEvent(playthrough.id, 100, 1.5);

      // Check event was recorded
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("play");
      expect(events[0]?.position).toBe(100);
      expect(events[0]?.playbackRate).toBe(1.5);
      expect(events[0]?.deviceId).toBe("test-device-id");

      // Check state cache was updated
      const stateCache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(stateCache?.currentPosition).toBe(100);
      expect(stateCache?.currentRate).toBe(1.5);
    });

    it("recordPauseEvent inserts a pause event and updates state cache", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await recordPauseEvent(playthrough.id, 200, 1.0);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("pause");
      expect(events[0]?.position).toBe(200);
      expect(events[0]?.playbackRate).toBe(1.0);

      const stateCache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(stateCache?.currentPosition).toBe(200);
    });

    it("recordSeekEvent inserts a seek event with from/to positions", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      const timestamp = new Date();
      await recordSeekEvent(playthrough.id, 50, 150, 1.0, timestamp);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("seek");
      expect(events[0]?.fromPosition).toBe(50);
      expect(events[0]?.toPosition).toBe(150);
      expect(events[0]?.position).toBe(150);

      const stateCache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(stateCache?.currentPosition).toBe(150);
    });

    it("recordRateChangeEvent inserts a rate_change event with previous rate", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await recordRateChangeEvent(playthrough.id, 100, 1.5, 1.0);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("rate_change");
      expect(events[0]?.playbackRate).toBe(1.5);
      expect(events[0]?.previousRate).toBe(1.0);

      const stateCache = await db.query.playthroughStateCache.findFirst({
        where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
      });

      expect(stateCache?.currentRate).toBe(1.5);
    });
  });

  describe("lifecycle events", () => {
    it("recordStartEvent inserts a start event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, { mediaId: media.id });

      await recordStartEvent(playthrough.id);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("start");
      expect(events[0]?.deviceId).toBe("test-device-id");
    });

    it("recordFinishEvent inserts a finish event", async () => {
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

    it("recordAbandonEvent inserts an abandon event", async () => {
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

    it("recordResumeEvent inserts a resume event", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, { mediaId: media.id });

      await recordResumeEvent(playthrough.id);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("resume");
    });
  });

  describe("session guard", () => {
    it("recordPlayEvent does nothing if no session", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      // Clear session
      useSession.setState({ session: null });

      await recordPlayEvent(playthrough.id, 100, 1.0);

      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.playthroughId, playthrough.id),
      });

      expect(events).toHaveLength(0);
    });
  });
});
