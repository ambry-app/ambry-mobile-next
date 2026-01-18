import { eq } from "drizzle-orm";

import * as playthroughs from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaybackEvent,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
  resetIdCounter,
} from "@test/factories";

const session = DEFAULT_TEST_SESSION;

describe("playthroughs module", () => {
  const { getDb } = setupTestDatabase();

  beforeEach(() => {
    resetIdCounter();
  });

  describe("getInProgressPlaythrough", () => {
    it("returns undefined when no playthrough exists", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const result = await playthroughs.getInProgressPlaythroughWithMedia(
        session,
        media.id,
      );

      expect(result).toBeUndefined();
    });

    it("returns playthrough with nested relations when found", async () => {
      const db = getDb();
      const media = await createMedia(db, { duration: "3600" });
      await createPlaythrough(db, {
        id: "pt-1",
        mediaId: media.id,
        status: "in_progress",
        position: 100,
        playbackRate: 1.5,
        cachePosition: 100,
      });

      const result = await playthroughs.getInProgressPlaythroughWithMedia(
        session,
        media.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-1");
      expect(result?.position).toBe(100);
      expect(result?.playbackRate).toBe(1.5);
      expect(result?.stateCache?.position).toBe(100);
      expect(result?.media.id).toBe(media.id);
    });

    it("does not return deleted playthroughs", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
        deletedAt: new Date(),
      });

      const result = await playthroughs.getInProgressPlaythroughWithMedia(
        session,
        media.id,
      );

      expect(result).toBeUndefined();
    });

    it("does not return finished playthroughs", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlaythrough(db, {
        mediaId: media.id,
        status: "finished",
      });

      const result = await playthroughs.getInProgressPlaythroughWithMedia(
        session,
        media.id,
      );

      expect(result).toBeUndefined();
    });

    it("returns most recent when multiple in-progress playthroughs exist (migration edge case)", async () => {
      const db = getDb();
      const media = await createMedia(db);

      // Create two in-progress playthroughs (simulating migration edge case)
      // Query orders by lastEventAt DESC, so newer lastEventAt wins
      const older = await createPlaythrough(db, {
        id: "pt-older",
        mediaId: media.id,
        status: "in_progress",
        lastEventAt: new Date("2024-01-01"),
      });

      const newer = await createPlaythrough(db, {
        id: "pt-newer",
        mediaId: media.id,
        status: "in_progress",
        lastEventAt: new Date("2024-01-02"),
      });

      const result = await playthroughs.getInProgressPlaythroughWithMedia(
        session,
        media.id,
      );

      // Should return the one with most recent lastEventAt
      expect(result?.id).toBe(newer.id);
      expect(result?.id).not.toBe(older.id);
    });
  });

  describe("getPlaythroughById", () => {
    it("returns playthrough when found", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, { id: "pt-123" });

      const result = await playthroughs.getPlaythroughWithMedia(
        session,
        "pt-123",
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(pt.id);
    });
  });

  describe("getFinishedOrAbandonedPlaythrough", () => {
    it("returns finished playthrough", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlaythrough(db, {
        id: "pt-finished",
        mediaId: media.id,
        status: "finished",
        finishedAt: new Date(),
      });

      const result = await playthroughs.getFinishedOrAbandonedPlaythrough(
        session,
        media.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-finished");
      expect(result?.status).toBe("finished");
    });

    it("returns abandoned playthrough", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlaythrough(db, {
        id: "pt-abandoned",
        mediaId: media.id,
        status: "abandoned",
        abandonedAt: new Date(),
      });

      const result = await playthroughs.getFinishedOrAbandonedPlaythrough(
        session,
        media.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-abandoned");
      expect(result?.status).toBe("abandoned");
    });

    it("returns most recent when multiple exist", async () => {
      const db = getDb();
      const media = await createMedia(db);
      // Now orders by finishedAt (for finished) or abandonedAt (for abandoned)
      await createPlaythrough(db, {
        id: "pt-old",
        mediaId: media.id,
        status: "finished",
        finishedAt: new Date("2024-01-01"),
      });
      await createPlaythrough(db, {
        id: "pt-new",
        mediaId: media.id,
        status: "finished",
        finishedAt: new Date("2024-06-01"),
      });

      const result = await playthroughs.getFinishedOrAbandonedPlaythrough(
        session,
        media.id,
      );

      expect(result?.id).toBe("pt-new");
    });
  });

  describe("getEffectivePosition", () => {
    it("returns playthrough position when no cache exists", () => {
      const result = playthroughs.getEffectivePosition({
        position: 500,
        lastEventAt: new Date("2024-01-15"),
        stateCache: null,
      });

      expect(result).toBe(500);
    });

    it("returns playthrough position when playthrough is newer", () => {
      const result = playthroughs.getEffectivePosition({
        position: 500,
        lastEventAt: new Date("2024-01-15T12:00:00Z"),
        stateCache: {
          position: 100,
          updatedAt: new Date("2024-01-15T10:00:00Z"),
        },
      });

      expect(result).toBe(500);
    });

    it("returns cache position when cache is newer", () => {
      const result = playthroughs.getEffectivePosition({
        position: 100,
        lastEventAt: new Date("2024-01-15T10:00:00Z"),
        stateCache: {
          position: 500,
          updatedAt: new Date("2024-01-15T12:00:00Z"),
        },
      });

      expect(result).toBe(500);
    });

    it("prefers playthrough when timestamps are equal", () => {
      const sameTime = new Date("2024-01-15T12:00:00Z");
      const result = playthroughs.getEffectivePosition({
        position: 100,
        lastEventAt: sameTime,
        stateCache: {
          position: 500,
          updatedAt: sameTime,
        },
      });

      // When equal, uses playthrough position (cache.updatedAt > lastEventAt is false)
      expect(result).toBe(100);
    });
  });

  describe("updateStateCache", () => {
    it("creates cache entry if none exists", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);

      await playthroughs.updateStateCache(pt.id, 100);

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, pt.id),
      });

      expect(cache).toBeDefined();
      expect(cache?.position).toBe(100);
    });

    it("updates existing cache entry", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, {
        cachePosition: 50,
        cacheUpdatedAt: new Date(Date.now() - 1000),
      });

      await playthroughs.updateStateCache(pt.id, 200);

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, pt.id),
      });

      expect(cache?.position).toBe(200);
    });
  });

  describe("sync helpers", () => {
    describe("getAllUnsyncedEvents", () => {
      it("returns events with null syncedAt", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db, { id: "pt-1" });
        await createPlaybackEvent(db, {
          id: "e-synced",
          playthroughId: pt.id,
          syncedAt: new Date(),
        });
        await createPlaybackEvent(db, {
          id: "e-unsynced",
          playthroughId: pt.id,
          syncedAt: null,
        });

        const result = await playthroughs.getAllUnsyncedEvents(session);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("e-unsynced");
      });

      it("returns events for this session only", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db, { id: "pt-1" });
        await createPlaybackEvent(db, {
          id: "e-unsynced",
          playthroughId: pt.id,
          syncedAt: null,
        });

        // Create another playthrough on different server
        const media2 = await createMedia(db, {
          url: "http://other-server.com",
        });
        const pt2 = await createPlaythrough(db, {
          id: "pt-2",
          url: "http://other-server.com",
          mediaId: media2.id,
        });
        await createPlaybackEvent(db, {
          id: "e-other-server",
          playthroughId: pt2.id,
          syncedAt: null,
        });

        const result = await playthroughs.getAllUnsyncedEvents(session);

        // Should only return events for default session URL
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("e-unsynced");
      });
    });

    describe("markEventsSynced", () => {
      it("does nothing for empty array", async () => {
        // Should not throw
        await playthroughs.markEventsSynced([], new Date());
      });

      it("updates syncedAt for given event IDs", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);
        const e1 = await createPlaybackEvent(db, {
          id: "e-1",
          playthroughId: pt.id,
          syncedAt: null,
        });
        const e2 = await createPlaybackEvent(db, {
          id: "e-2",
          playthroughId: pt.id,
          syncedAt: null,
        });
        const syncedAt = new Date("2024-01-01");

        await playthroughs.markEventsSynced([e1.id, e2.id], syncedAt);

        const updated1 = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, e1.id),
        });
        const updated2 = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, e2.id),
        });

        expect(updated1?.syncedAt).not.toBeNull();
        expect(updated2?.syncedAt).not.toBeNull();
      });
    });
  });

  describe("upsert functions", () => {
    describe("upsertPlaybackEvent", () => {
      it("inserts new events", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);
        const now = new Date();

        await playthroughs.upsertPlaybackEvents([
          {
            id: "e-new",
            playthroughId: pt.id,
            type: "play",
            timestamp: now,
            position: 100,
            syncedAt: now,
          },
        ]);

        const result = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, "e-new"),
        });

        expect(result).toBeDefined();
        expect(result?.position).toBe(100);
        expect(result?.syncedAt).not.toBeNull();
      });

      it("updates syncedAt on conflict", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);
        const event = await createPlaybackEvent(db, {
          id: "e-1",
          playthroughId: pt.id,
          type: "play",
          timestamp: new Date(),
          position: 200,
          playbackRate: 1.0,
          syncedAt: null,
        });
        const syncedAt = new Date("2024-06-01");

        await playthroughs.upsertPlaybackEvents([
          {
            id: event.id,
            playthroughId: pt.id,
            type: event.type,
            timestamp: event.timestamp,
            position: event.position,
            playbackRate: event.playbackRate,
            syncedAt,
          },
        ]);

        const result = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, event.id),
        });

        expect(result?.syncedAt).not.toBeNull();
      });
    });
  });

  describe("atomic event recording", () => {
    describe("recordStartEvent", () => {
      it("creates start event and playthrough in single transaction", async () => {
        const db = getDb();
        const media = await createMedia(db);

        const playthroughId = await playthroughs.recordStartEvent(
          session,
          media.id,
          "test-device",
          1.5,
        );

        // Verify event was created
        const event = await db.query.playbackEvents.findFirst({
          where: (e, { eq }) => eq(e.playthroughId, playthroughId),
        });
        expect(event).toBeDefined();
        expect(event?.type).toBe("start");
        expect(event?.mediaId).toBe(media.id);
        expect(event?.deviceId).toBe("test-device");
        expect(event?.playbackRate).toBe(1.5);

        // Verify playthrough was created via rebuild
        const pt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, playthroughId),
        });
        expect(pt).toBeDefined();
        expect(pt?.status).toBe("in_progress");
        expect(pt?.mediaId).toBe(media.id);
        expect(pt?.playbackRate).toBe(1.5);
      });
    });

    describe("recordPlaybackEvent", () => {
      it("creates play event and updates playthrough state", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordPlayPauseEvent(session, pt.id, "test-device", {
          type: "play",
          timestamp: new Date(),
          position: 100,
        });

        // Verify event was created
        const events = await db.query.playbackEvents.findMany({
          where: (e, { eq }) => eq(e.playthroughId, pt.id),
        });
        const playEvent = events.find((e) => e.type === "play");
        expect(playEvent).toBeDefined();
        expect(playEvent?.position).toBe(100);

        // Verify playthrough was updated via rebuild
        const updatedPt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, pt.id),
        });
        expect(updatedPt?.position).toBe(100);
      });

      it("creates seek event with from/to positions", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordSeekEvent(session, pt.id, "test-device", {
          timestamp: new Date(),
          position: 600,
          fromPosition: 100,
          toPosition: 600,
        });

        const events = await db.query.playbackEvents.findMany({
          where: (e, { eq }) => eq(e.playthroughId, pt.id),
        });
        const seekEvent = events.find((e) => e.type === "seek");
        expect(seekEvent).toBeDefined();
        expect(seekEvent?.fromPosition).toBe(100);
        expect(seekEvent?.toPosition).toBe(600);
      });

      it("creates rate_change event with previous rate", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordRateChangeEvent(
          session,
          pt.id,
          "test-device",
          {
            timestamp: new Date(),
            position: 500,
            playbackRate: 2.0,
          },
        );

        const events = await db.query.playbackEvents.findMany({
          where: (e, { eq }) => eq(e.playthroughId, pt.id),
        });
        const rateEvent = events.find((e) => e.type === "rate_change");
        expect(rateEvent).toBeDefined();
        expect(rateEvent?.playbackRate).toBe(2.0);
      });
    });

    describe("recordLifecycleEvent", () => {
      it("creates finish event and updates playthrough status", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordLifecycleEvent(
          session,
          pt.id,
          "test-device",
          "finish",
        );

        // Verify event was created
        const events = await db.query.playbackEvents.findMany({
          where: (e, { eq }) => eq(e.playthroughId, pt.id),
        });
        const finishEvent = events.find((e) => e.type === "finish");
        expect(finishEvent).toBeDefined();

        // Verify playthrough was updated via rebuild
        const updatedPt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, pt.id),
        });
        expect(updatedPt?.status).toBe("finished");
        expect(updatedPt?.finishedAt).toBeDefined();
      });

      it("creates abandon event and updates playthrough status", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordLifecycleEvent(
          session,
          pt.id,
          "test-device",
          "abandon",
        );

        const updatedPt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, pt.id),
        });
        expect(updatedPt?.status).toBe("abandoned");
        expect(updatedPt?.abandonedAt).toBeDefined();
      });

      it("creates resume event and updates playthrough to in_progress", async () => {
        const db = getDb();
        // Create a finished playthrough to resume
        const pt = await createPlaythrough(db, { status: "finished" });

        await playthroughs.recordLifecycleEvent(
          session,
          pt.id,
          "test-device",
          "resume",
        );

        const updatedPt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, pt.id),
        });
        expect(updatedPt?.status).toBe("in_progress");
      });

      it("creates delete event and updates playthrough with deletedAt", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.recordLifecycleEvent(
          session,
          pt.id,
          "test-device",
          "delete",
        );

        const updatedPt = await db.query.playthroughs.findFirst({
          where: (p, { eq }) => eq(p.id, pt.id),
        });
        expect(updatedPt?.status).toBe("deleted");
        expect(updatedPt?.deletedAt).toBeDefined();
      });
    });
  });
});
