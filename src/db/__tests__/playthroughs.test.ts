import { and, desc, eq, isNull } from "drizzle-orm";
import { createTestDatabase, TestDatabase } from "../test-utils";
import * as schema from "../schema";

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  randomUUID: () => "test-uuid-" + Math.random().toString(36).substring(7),
}));

// We'll test the database operations directly using our test database
// rather than mocking, since that tests the actual SQL logic

describe("playthroughs database operations", () => {
  const { getDb } = useTestDatabase();

  const testSession = {
    url: "http://test-server.com",
    email: "test@example.com",
    token: "test-token",
  };

  // Helper to create required media record (playthroughs have FK to media)
  async function createTestMedia(db: TestDatabase, mediaId: string) {
    const now = new Date();

    // First create a book (media FK to books)
    const book: typeof schema.books.$inferInsert = {
      url: testSession.url,
      id: "book-1",
      title: "Test Book",
      published: now,
      publishedFormat: "full",
      insertedAt: now,
      updatedAt: now,
    };
    await db.insert(schema.books).values(book);

    // Then create the media
    const media: typeof schema.media.$inferInsert = {
      url: testSession.url,
      id: mediaId,
      bookId: "book-1",
      chapters: [],
      supplementalFiles: [],
      fullCast: false,
      abridged: false,
      publishedFormat: "full",
      insertedAt: now,
      updatedAt: now,
    };
    await db.insert(schema.media).values(media);
  }

  // Helper to create a playthrough directly
  async function createPlaythrough(
    db: TestDatabase,
    overrides: Partial<schema.PlaythroughInsert> = {},
  ) {
    const now = new Date();
    const id =
      overrides.id ?? `playthrough-${Math.random().toString(36).substring(7)}`;

    const playthrough: schema.PlaythroughInsert = {
      id,
      url: testSession.url,
      userEmail: testSession.email,
      mediaId: "media-1",
      status: "in_progress",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };

    await db.insert(schema.playthroughs).values(playthrough);
    return playthrough;
  }

  describe("playthrough queries", () => {
    it("finds active playthrough for media", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1", status: "in_progress" });

      const result = await db.query.playthroughs.findFirst({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.userEmail, testSession.email),
          eq(schema.playthroughs.mediaId, "media-1"),
          eq(schema.playthroughs.status, "in_progress"),
          isNull(schema.playthroughs.deletedAt),
        ),
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe("pt-1");
    });

    it("does not find deleted playthroughs", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, {
        id: "pt-deleted",
        status: "in_progress",
        deletedAt: new Date(),
      });

      const result = await db.query.playthroughs.findFirst({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.userEmail, testSession.email),
          eq(schema.playthroughs.mediaId, "media-1"),
          eq(schema.playthroughs.status, "in_progress"),
          isNull(schema.playthroughs.deletedAt),
        ),
      });

      expect(result).toBeUndefined();
    });

    it("does not find finished playthroughs when looking for active", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-finished", status: "finished" });

      const result = await db.query.playthroughs.findFirst({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.userEmail, testSession.email),
          eq(schema.playthroughs.mediaId, "media-1"),
          eq(schema.playthroughs.status, "in_progress"),
          isNull(schema.playthroughs.deletedAt),
        ),
      });

      expect(result).toBeUndefined();
    });

    it("isolates playthroughs by server URL", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");

      // Create media on other server for FK constraint
      const now = new Date();
      const otherBook: typeof schema.books.$inferInsert = {
        url: "http://other-server.com",
        id: "book-1",
        title: "Other Book",
        published: now,
        publishedFormat: "full",
        insertedAt: now,
        updatedAt: now,
      };
      await db.insert(schema.books).values(otherBook);

      const otherMedia: typeof schema.media.$inferInsert = {
        url: "http://other-server.com",
        id: "media-1",
        bookId: "book-1",
        chapters: [],
        supplementalFiles: [],
        fullCast: false,
        abridged: false,
        publishedFormat: "full",
        insertedAt: now,
        updatedAt: now,
      };
      await db.insert(schema.media).values(otherMedia);

      await createPlaythrough(db, {
        id: "pt-other-server",
        url: "http://other-server.com",
      });

      const result = await db.query.playthroughs.findFirst({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.mediaId, "media-1"),
        ),
      });

      expect(result).toBeUndefined();
    });

    it("isolates playthroughs by user email", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, {
        id: "pt-other-user",
        userEmail: "other@example.com",
      });

      const result = await db.query.playthroughs.findFirst({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.userEmail, testSession.email),
          eq(schema.playthroughs.mediaId, "media-1"),
        ),
      });

      expect(result).toBeUndefined();
    });
  });

  describe("playthrough status updates", () => {
    it("updates status to finished", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1", status: "in_progress" });

      const finishedAt = new Date();
      await db
        .update(schema.playthroughs)
        .set({
          status: "finished",
          finishedAt,
          updatedAt: new Date(),
          syncedAt: null,
        })
        .where(eq(schema.playthroughs.id, "pt-1"));

      const result = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, "pt-1"),
      });

      expect(result?.status).toBe("finished");
      // SQLite stores timestamps as integers (seconds), so we compare within 1 second
      expect(result?.finishedAt?.getTime()).toBeCloseTo(
        finishedAt.getTime(),
        -4,
      );
      expect(result?.syncedAt).toBeNull();
    });

    it("resumes a finished playthrough", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, {
        id: "pt-1",
        status: "finished",
        finishedAt: new Date(),
      });

      await db
        .update(schema.playthroughs)
        .set({
          status: "in_progress",
          finishedAt: null,
          abandonedAt: null,
          updatedAt: new Date(),
          syncedAt: null,
        })
        .where(eq(schema.playthroughs.id, "pt-1"));

      const result = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, "pt-1"),
      });

      expect(result?.status).toBe("in_progress");
      expect(result?.finishedAt).toBeNull();
    });

    it("soft deletes a playthrough", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1" });

      const deletedAt = new Date();
      await db
        .update(schema.playthroughs)
        .set({
          deletedAt,
          updatedAt: new Date(),
          syncedAt: null,
        })
        .where(eq(schema.playthroughs.id, "pt-1"));

      const result = await db.query.playthroughs.findFirst({
        where: eq(schema.playthroughs.id, "pt-1"),
      });

      // SQLite stores timestamps as integers (seconds), so we compare within 1 second
      expect(result?.deletedAt?.getTime()).toBeCloseTo(deletedAt.getTime(), -4);
    });
  });

  describe("state cache", () => {
    it("creates state cache entry", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1" });

      const now = new Date();
      await db.insert(schema.playthroughStateCache).values({
        playthroughId: "pt-1",
        currentPosition: 123.45,
        currentRate: 1.5,
        lastEventAt: now,
        updatedAt: now,
      });

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, "pt-1"),
      });

      expect(cache?.currentPosition).toBe(123.45);
      expect(cache?.currentRate).toBe(1.5);
    });

    it("updates state cache on conflict", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1" });

      const now = new Date();

      // Initial insert
      await db.insert(schema.playthroughStateCache).values({
        playthroughId: "pt-1",
        currentPosition: 100,
        currentRate: 1.0,
        lastEventAt: now,
        updatedAt: now,
      });

      // Update via upsert
      await db
        .insert(schema.playthroughStateCache)
        .values({
          playthroughId: "pt-1",
          currentPosition: 200,
          currentRate: 1.5,
          lastEventAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.playthroughStateCache.playthroughId,
          set: {
            currentPosition: 200,
            currentRate: 1.5,
            lastEventAt: now,
            updatedAt: now,
          },
        });

      const cache = await db.query.playthroughStateCache.findFirst({
        where: eq(schema.playthroughStateCache.playthroughId, "pt-1"),
      });

      expect(cache?.currentPosition).toBe(200);
      expect(cache?.currentRate).toBe(1.5);
    });
  });

  describe("sync helpers", () => {
    it("finds unsynced playthroughs", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-synced", syncedAt: new Date() });
      await createPlaythrough(db, { id: "pt-unsynced", syncedAt: null });

      const unsynced = await db.query.playthroughs.findMany({
        where: and(
          eq(schema.playthroughs.url, testSession.url),
          eq(schema.playthroughs.userEmail, testSession.email),
          isNull(schema.playthroughs.syncedAt),
        ),
      });

      expect(unsynced).toHaveLength(1);
      expect(unsynced[0]?.id).toBe("pt-unsynced");
    });

    it("marks playthroughs as synced", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1", syncedAt: null });
      await createPlaythrough(db, { id: "pt-2", syncedAt: null });

      const syncedAt = new Date();
      await db
        .update(schema.playthroughs)
        .set({ syncedAt })
        .where(
          and(
            eq(schema.playthroughs.url, testSession.url),
            isNull(schema.playthroughs.syncedAt),
          ),
        );

      const results = await db.query.playthroughs.findMany({
        where: eq(schema.playthroughs.url, testSession.url),
      });

      expect(results.every((p) => p.syncedAt !== null)).toBe(true);
    });
  });

  describe("playback events", () => {
    it("creates playback events", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1" });

      const now = new Date();
      await db.insert(schema.playbackEvents).values({
        id: "event-1",
        playthroughId: "pt-1",
        type: "play",
        timestamp: now,
        position: 0,
        playbackRate: 1.0,
      });

      const event = await db.query.playbackEvents.findFirst({
        where: eq(schema.playbackEvents.id, "event-1"),
      });

      expect(event?.type).toBe("play");
      expect(event?.position).toBe(0);
    });

    it("finds most recent event for state derivation", async () => {
      const db = getDb();
      await createTestMedia(db, "media-1");
      await createPlaythrough(db, { id: "pt-1" });

      const t1 = new Date("2024-01-01T10:00:00Z");
      const t2 = new Date("2024-01-01T10:05:00Z");
      const t3 = new Date("2024-01-01T10:10:00Z");

      await db.insert(schema.playbackEvents).values([
        {
          id: "e1",
          playthroughId: "pt-1",
          type: "play",
          timestamp: t1,
          position: 0,
          playbackRate: 1.0,
        },
        {
          id: "e2",
          playthroughId: "pt-1",
          type: "pause",
          timestamp: t2,
          position: 100,
          playbackRate: 1.0,
        },
        {
          id: "e3",
          playthroughId: "pt-1",
          type: "play",
          timestamp: t3,
          position: 100,
          playbackRate: 1.5,
        },
      ]);

      const lastEvent = await db.query.playbackEvents.findFirst({
        where: eq(schema.playbackEvents.playthroughId, "pt-1"),
        orderBy: desc(schema.playbackEvents.timestamp),
      });

      expect(lastEvent?.id).toBe("e3");
      expect(lastEvent?.position).toBe(100);
      expect(lastEvent?.playbackRate).toBe(1.5);
    });
  });
});

function useTestDatabase() {
  let testDb: { db: TestDatabase; close: () => void } | null = null;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb?.close();
    testDb = null;
  });

  return {
    getDb: () => {
      if (!testDb) {
        throw new Error("Test database not initialized");
      }
      return testDb.db;
    },
  };
}
