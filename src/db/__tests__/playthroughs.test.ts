import { eq } from "drizzle-orm";

import * as playthroughs from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { Session } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaybackEvent,
  createPlaythrough,
  createPlaythroughStateCache,
  DEFAULT_TEST_SESSION,
  resetIdCounter,
} from "@test/factories";

describe("playthroughs module", () => {
  const { getDb } = setupTestDatabase();

  const testSession: Session = {
    url: DEFAULT_TEST_SESSION.url,
    email: DEFAULT_TEST_SESSION.email,
    token: "test-token",
  };

  beforeEach(() => {
    resetIdCounter();
  });

  describe("getActivePlaythrough", () => {
    it("returns undefined when no playthrough exists", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const result = await playthroughs.getActivePlaythrough(
        testSession,
        media.id,
      );

      expect(result).toBeUndefined();
    });

    it("returns playthrough with nested relations when found", async () => {
      const db = getDb();
      const media = await createMedia(db, { duration: "3600" });
      const pt = await createPlaythrough(db, {
        id: "pt-1",
        mediaId: media.id,
        status: "in_progress",
      });
      await createPlaythroughStateCache(db, {
        playthroughId: pt.id,
        currentPosition: 100,
        currentRate: 1.5,
      });

      const result = await playthroughs.getActivePlaythrough(
        testSession,
        media.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-1");
      expect(result?.stateCache?.currentPosition).toBe(100);
      expect(result?.stateCache?.currentRate).toBe(1.5);
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

      const result = await playthroughs.getActivePlaythrough(
        testSession,
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

      const result = await playthroughs.getActivePlaythrough(
        testSession,
        media.id,
      );

      expect(result).toBeUndefined();
    });
  });

  describe("getPlaythroughById", () => {
    it("returns playthrough when found", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, { id: "pt-123" });

      const result = await playthroughs.getPlaythroughById(
        testSession,
        "pt-123",
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(pt.id);
    });

    it("returns undefined when not found", async () => {
      const result = await playthroughs.getPlaythroughById(
        testSession,
        "nonexistent",
      );

      expect(result).toBeUndefined();
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
        testSession,
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
        testSession,
        media.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-abandoned");
      expect(result?.status).toBe("abandoned");
    });

    it("returns most recent when multiple exist", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createPlaythrough(db, {
        id: "pt-old",
        mediaId: media.id,
        status: "finished",
        updatedAt: new Date("2024-01-01"),
      });
      await createPlaythrough(db, {
        id: "pt-new",
        mediaId: media.id,
        status: "finished",
        updatedAt: new Date("2024-06-01"),
      });

      const result = await playthroughs.getFinishedOrAbandonedPlaythrough(
        testSession,
        media.id,
      );

      expect(result?.id).toBe("pt-new");
    });
  });

  describe("createPlaythrough", () => {
    it("creates a new playthrough with correct values", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const id = await playthroughs.createPlaythrough(testSession, media.id);

      // Should be a valid UUID
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      const created = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, id),
      });

      expect(created).toBeDefined();
      expect(created?.url).toBe(testSession.url);
      expect(created?.userEmail).toBe(testSession.email);
      expect(created?.mediaId).toBe(media.id);
      expect(created?.status).toBe("in_progress");
      expect(created?.syncedAt).toBeNull();
    });
  });

  describe("updatePlaythroughStatus", () => {
    it("updates status and marks for sync", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, {
        status: "in_progress",
        syncedAt: new Date(),
      });

      await playthroughs.updatePlaythroughStatus(
        testSession,
        pt.id,
        "finished",
        { finishedAt: new Date("2024-01-01") },
      );

      const updated = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, pt.id),
      });

      expect(updated?.status).toBe("finished");
      expect(updated?.finishedAt?.getTime()).toBeCloseTo(
        new Date("2024-01-01").getTime(),
        -4,
      );
      expect(updated?.syncedAt).toBeNull();
    });
  });

  describe("resumePlaythrough", () => {
    it("sets status to in_progress and clears finish/abandon timestamps", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, {
        status: "finished",
        finishedAt: new Date(),
        syncedAt: new Date(),
      });

      await playthroughs.resumePlaythrough(testSession, pt.id);

      const updated = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, pt.id),
      });

      expect(updated?.status).toBe("in_progress");
      expect(updated?.finishedAt).toBeNull();
      expect(updated?.abandonedAt).toBeNull();
      expect(updated?.syncedAt).toBeNull();
    });
  });

  describe("deletePlaythrough", () => {
    it("soft deletes by setting deletedAt", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db, { syncedAt: new Date() });

      await playthroughs.deletePlaythrough(testSession, pt.id);

      const updated = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, pt.id),
      });

      expect(updated?.deletedAt).not.toBeNull();
      expect(updated?.syncedAt).toBeNull();
    });
  });

  describe("getDerivedState", () => {
    it("returns cached state when available", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);
      await createPlaythroughStateCache(db, {
        playthroughId: pt.id,
        currentPosition: 500,
        currentRate: 1.25,
        lastEventAt: new Date("2024-01-01"),
      });

      const result = await playthroughs.getDerivedState(pt.id);

      expect(result).toEqual({
        currentPosition: 500,
        currentRate: 1.25,
        lastEventAt: expect.any(Date),
      });
    });

    it("computes state from events on cache miss", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);
      await createPlaybackEvent(db, {
        playthroughId: pt.id,
        type: "pause",
        position: 300,
        playbackRate: 1.5,
        timestamp: new Date("2024-01-02"),
      });

      const result = await playthroughs.getDerivedState(pt.id);

      expect(result).toEqual({
        currentPosition: 300,
        currentRate: 1.5,
        lastEventAt: expect.any(Date),
      });

      // Should have created cache entry
      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, pt.id),
      });
      expect(cache).toBeDefined();
      expect(cache?.currentPosition).toBe(300);
    });

    it("returns null when no cache and no events", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);

      const result = await playthroughs.getDerivedState(pt.id);

      expect(result).toBeNull();
    });
  });

  describe("computeStateFromEvents", () => {
    it("finds most recent playback event and updates cache", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);
      await createPlaybackEvent(db, {
        playthroughId: pt.id,
        type: "play",
        position: 100,
        playbackRate: 1.0,
        timestamp: new Date("2024-01-01"),
      });
      await createPlaybackEvent(db, {
        playthroughId: pt.id,
        type: "pause",
        position: 250,
        playbackRate: 2.0,
        timestamp: new Date("2024-01-03"),
      });

      const result = await playthroughs.computeStateFromEvents(pt.id);

      expect(result).toEqual({
        currentPosition: 250,
        currentRate: 2.0,
        lastEventAt: expect.any(Date),
      });
    });

    it("returns null when event has no position", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);
      await createPlaybackEvent(db, {
        playthroughId: pt.id,
        type: "start",
        position: null,
        playbackRate: null,
      });

      const result = await playthroughs.computeStateFromEvents(pt.id);

      expect(result).toBeNull();
    });
  });

  describe("updateStateCache", () => {
    it("creates cache entry if none exists", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);

      await playthroughs.updateStateCache(pt.id, 100, 1.5);

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, pt.id),
      });

      expect(cache).toBeDefined();
      expect(cache?.currentPosition).toBe(100);
      expect(cache?.currentRate).toBe(1.5);
    });

    it("updates existing cache entry", async () => {
      const db = getDb();
      const pt = await createPlaythrough(db);
      await createPlaythroughStateCache(db, {
        playthroughId: pt.id,
        currentPosition: 50,
        currentRate: 1.0,
      });

      await playthroughs.updateStateCache(pt.id, 200, 2.0);

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, pt.id),
      });

      expect(cache?.currentPosition).toBe(200);
      expect(cache?.currentRate).toBe(2.0);
    });
  });

  describe("getMostRecentInProgressPlaythrough", () => {
    it("returns most recent in_progress playthrough", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db);
      await createPlaythrough(db, {
        id: "pt-old",
        mediaId: media1.id,
        status: "in_progress",
        updatedAt: new Date("2024-01-01"),
      });
      await createPlaythrough(db, {
        id: "pt-new",
        mediaId: media2.id,
        status: "in_progress",
        updatedAt: new Date("2024-06-01"),
      });

      const result =
        await playthroughs.getMostRecentInProgressPlaythrough(testSession);

      expect(result?.id).toBe("pt-new");
    });

    it("returns undefined when no in_progress playthroughs", async () => {
      const result =
        await playthroughs.getMostRecentInProgressPlaythrough(testSession);

      expect(result).toBeUndefined();
    });
  });

  describe("sync helpers", () => {
    describe("getUnsyncedPlaythroughs", () => {
      it("returns playthroughs with null syncedAt", async () => {
        const db = getDb();
        const media = await createMedia(db);
        await createPlaythrough(db, {
          id: "pt-synced",
          mediaId: media.id,
          syncedAt: new Date(),
        });
        await createPlaythrough(db, {
          id: "pt-unsynced",
          mediaId: media.id,
          syncedAt: null,
        });

        const result = await playthroughs.getUnsyncedPlaythroughs(testSession);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("pt-unsynced");
      });
    });

    describe("getUnsyncedEvents", () => {
      it("returns empty array for empty input", async () => {
        const result = await playthroughs.getUnsyncedEvents([]);

        expect(result).toEqual([]);
      });

      it("returns events with null syncedAt for given playthrough IDs", async () => {
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

        const result = await playthroughs.getUnsyncedEvents([pt.id]);

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("e-unsynced");
      });
    });

    describe("markPlaythroughsSynced", () => {
      it("does nothing for empty array", async () => {
        // Should not throw
        await playthroughs.markPlaythroughsSynced([], new Date());
      });

      it("updates syncedAt for given IDs", async () => {
        const db = getDb();
        const pt1 = await createPlaythrough(db, {
          id: "pt-1",
          syncedAt: null,
        });
        const pt2 = await createPlaythrough(db, {
          id: "pt-2",
          syncedAt: null,
        });
        const syncedAt = new Date("2024-01-01");

        await playthroughs.markPlaythroughsSynced([pt1.id, pt2.id], syncedAt);

        const updated1 = await db.query.playthroughs.findFirst({
          where: eq(schema.playthroughs.id, pt1.id),
        });
        const updated2 = await db.query.playthroughs.findFirst({
          where: eq(schema.playthroughs.id, pt2.id),
        });

        expect(updated1?.syncedAt).not.toBeNull();
        expect(updated2?.syncedAt).not.toBeNull();
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
    describe("upsertPlaythrough", () => {
      it("inserts new playthrough", async () => {
        const db = getDb();
        const media = await createMedia(db);
        const now = new Date();

        await playthroughs.upsertPlaythrough({
          id: "pt-new",
          url: testSession.url,
          userEmail: testSession.email,
          mediaId: media.id,
          status: "in_progress",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        const result = await db.query.playthroughs.findFirst({
          where: eq(schema.playthroughs.id, "pt-new"),
        });

        expect(result).toBeDefined();
        expect(result?.mediaId).toBe(media.id);
      });

      it("updates existing playthrough on conflict", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db, {
          id: "pt-1",
          status: "in_progress",
        });

        await playthroughs.upsertPlaythrough({
          id: pt.id,
          url: testSession.url,
          userEmail: testSession.email,
          mediaId: pt.mediaId,
          status: "finished",
          finishedAt: new Date(),
          startedAt: pt.startedAt,
          createdAt: pt.createdAt,
          updatedAt: new Date(),
        });

        const result = await db.query.playthroughs.findFirst({
          where: eq(schema.playthroughs.id, pt.id),
        });

        expect(result?.status).toBe("finished");
      });
    });

    describe("upsertPlaybackEvent", () => {
      it("inserts new event", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);

        await playthroughs.upsertPlaybackEvent({
          id: "e-new",
          playthroughId: pt.id,
          type: "play",
          timestamp: new Date(),
          position: 100,
          playbackRate: 1.0,
        });

        const result = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, "e-new"),
        });

        expect(result).toBeDefined();
        expect(result?.position).toBe(100);
      });

      it("updates syncedAt on conflict", async () => {
        const db = getDb();
        const pt = await createPlaythrough(db);
        const event = await createPlaybackEvent(db, {
          id: "e-1",
          playthroughId: pt.id,
          syncedAt: null,
        });
        const syncedAt = new Date("2024-06-01");

        await playthroughs.upsertPlaybackEvent({
          id: event.id,
          playthroughId: pt.id,
          type: event.type,
          timestamp: event.timestamp,
          position: event.position,
          playbackRate: event.playbackRate,
          syncedAt,
        });

        const result = await db.query.playbackEvents.findFirst({
          where: eq(schema.playbackEvents.id, event.id),
        });

        expect(result?.syncedAt).not.toBeNull();
      });
    });
  });
});
