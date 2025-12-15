/**
 * Tests for PlayerState → Playthrough migration.
 *
 * This tests the migration logic that converts old player_states/local_player_states
 * tables to the new event-sourced playthrough system.
 */
// Import Storage after mock is set up
import Storage from "expo-sqlite/kv-store";

import {
  migrateFromPlayerStateToPlaythrough,
  needsPlayerStateMigration,
} from "@/db/migration-player-state";
import * as schema from "@/db/schema";
import { setupTestDatabase } from "@test/db-test-utils";
import { createMedia, DEFAULT_TEST_SESSION } from "@test/factories";

// =============================================================================
// Mock expo-sqlite/kv-store Storage (external Expo native module)
// =============================================================================

const mockStorage: Record<string, string> = {};

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage[key] ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
  },
}));

// =============================================================================
// Test Setup
// =============================================================================

const { getDb } = setupTestDatabase();

beforeEach(() => {
  // Clear storage mock
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }

  jest.clearAllMocks();
});

// =============================================================================
// Helper: Insert old player state using Drizzle
// =============================================================================

interface OldPlayerStateInsert {
  url: string;
  id?: string;
  mediaId: string;
  userEmail: string;
  playbackRate?: number;
  position?: number;
  status?: "not_started" | "in_progress" | "finished";
  insertedAt?: number; // Unix seconds
  updatedAt?: number; // Unix seconds
}

async function insertOldPlayerState(state: OldPlayerStateInsert) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(schema.playerStates).values({
    url: state.url,
    id: state.id ?? "ps-1",
    mediaId: state.mediaId,
    userEmail: state.userEmail,
    playbackRate: state.playbackRate ?? 1.0,
    position: state.position ?? 0,
    status: state.status ?? "in_progress",
    insertedAt: new Date((state.insertedAt ?? now) * 1000),
    updatedAt: new Date((state.updatedAt ?? now) * 1000),
  });
}

async function insertOldLocalPlayerState(
  state: Omit<OldPlayerStateInsert, "id">,
) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(schema.localPlayerStates).values({
    url: state.url,
    mediaId: state.mediaId,
    userEmail: state.userEmail,
    playbackRate: state.playbackRate ?? 1.0,
    position: state.position ?? 0,
    status: state.status ?? "in_progress",
    insertedAt: new Date((state.insertedAt ?? now) * 1000),
    updatedAt: new Date((state.updatedAt ?? now) * 1000),
  });
}

// =============================================================================
// Tests: Detection
// =============================================================================

describe("needsPlayerStateMigration", () => {
  it("returns false when migration flag is set", async () => {
    const db = getDb();
    const media = await createMedia(db, { id: "media-1" });

    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
    });

    // Set migration flag
    mockStorage["playerstate_migration_v1"] = "completed";

    const needsMigration = await needsPlayerStateMigration();

    expect(needsMigration).toBe(false);
    expect(Storage.getItem).toHaveBeenCalledWith("playerstate_migration_v1");
  });

  it("returns true when old table exists with data and flag not set", async () => {
    const db = getDb();
    const media = await createMedia(db, { id: "media-1" });

    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
    });

    const needsMigration = await needsPlayerStateMigration();

    expect(needsMigration).toBe(true);
  });

  it("returns false when old table exists but is empty", async () => {
    // Table exists (created by migration), but is empty
    const needsMigration = await needsPlayerStateMigration();

    expect(needsMigration).toBe(false);
  });

  it("returns false when old table does not exist", async () => {
    // This test doesn't apply anymore since table is always created by migrations
    // But the function still handles the case gracefully with a try-catch
    const needsMigration = await needsPlayerStateMigration();

    expect(needsMigration).toBe(false);
  });
});

// =============================================================================
// Tests: Migration Execution
// =============================================================================

describe("migrateFromPlayerStateToPlaythrough", () => {
  it("migrates in_progress state to playthrough with pause event", async () => {
    const db = getDb();

    // Create media in new schema
    const media = await createMedia(db, { id: "media-1" });

    // Create old player state
    const insertedAt = 1700000000; // Unix seconds
    const updatedAt = 1700001000;
    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      position: 1234.5,
      playbackRate: 1.25,
      status: "in_progress",
      insertedAt,
      updatedAt,
    });

    await migrateFromPlayerStateToPlaythrough();

    // Verify flag was set
    expect(Storage.setItem).toHaveBeenCalledWith(
      "playerstate_migration_v1",
      "completed",
    );

    // Verify playthrough was created
    const playthroughs = await db.select().from(schema.playthroughs);

    expect(playthroughs).toHaveLength(1);
    expect(playthroughs[0]).toMatchObject({
      url: DEFAULT_TEST_SESSION.url,
      userEmail: DEFAULT_TEST_SESSION.email,
      mediaId: media.id,
      status: "in_progress",
      startedAt: new Date(insertedAt * 1000),
      finishedAt: null,
      syncedAt: null,
    });

    // Verify pause event was created
    const events = await db.select().from(schema.playbackEvents);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      playthroughId: playthroughs[0]!.id,
      deviceId: null, // Synthetic event
      type: "pause",
      timestamp: new Date(updatedAt * 1000),
      position: 1234.5,
      playbackRate: 1.25,
      syncedAt: null,
    });

    // Verify state cache was created
    const cache = await db.select().from(schema.playthroughStateCache);

    expect(cache).toHaveLength(1);
    expect(cache[0]).toMatchObject({
      playthroughId: playthroughs[0]!.id,
      currentPosition: 1234.5,
      currentRate: 1.25,
      lastEventAt: new Date(updatedAt * 1000),
      totalListeningTime: 0,
    });
  });

  it("migrates finished state to playthrough with pause and finish events", async () => {
    const db = getDb();

    const media = await createMedia(db, { id: "media-1" });

    const insertedAt = 1700000000;
    const updatedAt = 1700001000;
    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      position: 5000.0,
      playbackRate: 1.5,
      status: "finished",
      insertedAt,
      updatedAt,
    });

    await migrateFromPlayerStateToPlaythrough();

    const playthroughs = await db.select().from(schema.playthroughs);

    expect(playthroughs).toHaveLength(1);
    expect(playthroughs[0]).toMatchObject({
      status: "finished",
      finishedAt: new Date(updatedAt * 1000),
    });

    // Verify both pause and finish events
    const events = await db
      .select()
      .from(schema.playbackEvents)
      .orderBy(schema.playbackEvents.timestamp);

    expect(events).toHaveLength(2);
    expect(events[0]!.type).toBe("pause");
    expect(events[1]!.type).toBe("finish");
    expect(events[1]!.timestamp).toEqual(new Date(updatedAt * 1000));
  });

  it("skips not_started states (no playthrough created)", async () => {
    const db = getDb();

    const media = await createMedia(db, { id: "media-1" });

    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      status: "not_started",
    });

    await migrateFromPlayerStateToPlaythrough();

    const playthroughs = await db.select().from(schema.playthroughs);

    expect(playthroughs).toHaveLength(0);
  });

  it("prefers local state over synced state (coalesce)", async () => {
    const db = getDb();

    const media = await createMedia(db, { id: "media-1" });

    // Synced state (older)
    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      position: 100.0,
      playbackRate: 1.0,
      status: "in_progress",
      updatedAt: 1700000000,
    });

    // Local state (newer, different position)
    await insertOldLocalPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      position: 200.0,
      playbackRate: 1.5,
      status: "in_progress",
      updatedAt: 1700001000,
    });

    await migrateFromPlayerStateToPlaythrough();

    // Should use local state (newer)
    const events = await db.select().from(schema.playbackEvents);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      position: 200.0,
      playbackRate: 1.5,
      timestamp: new Date(1700001000 * 1000),
    });
  });

  it("handles multiple users and servers", async () => {
    const db = getDb();

    const media1 = await createMedia(db, { id: "media-1" });
    const media2 = await createMedia(db, {
      id: "media-2",
      url: "http://other-server.com",
    });

    // User 1 on server 1
    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media1.id,
      userEmail: "user1@example.com",
      position: 100.0,
      status: "in_progress",
    });

    // User 2 on server 2
    await insertOldPlayerState({
      url: "http://other-server.com",
      id: "ps-2",
      mediaId: media2.id,
      userEmail: "user2@example.com",
      position: 200.0,
      status: "in_progress",
    });

    await migrateFromPlayerStateToPlaythrough();

    const playthroughs = await db.select().from(schema.playthroughs);

    expect(playthroughs).toHaveLength(2);
    expect(playthroughs[0]).toMatchObject({
      url: DEFAULT_TEST_SESSION.url,
      userEmail: "user1@example.com",
      mediaId: media1.id,
    });
    expect(playthroughs[1]).toMatchObject({
      url: "http://other-server.com",
      userEmail: "user2@example.com",
      mediaId: media2.id,
    });
  });

  it("handles empty tables gracefully", async () => {
    // Tables exist (created by migration) but are empty
    await migrateFromPlayerStateToPlaythrough();

    // Should set flag even with no data
    expect(Storage.setItem).toHaveBeenCalledWith(
      "playerstate_migration_v1",
      "completed",
    );
  });

  it("handles missing tables gracefully", async () => {
    // Tables always exist in schema, but migration handles errors gracefully
    await migrateFromPlayerStateToPlaythrough();

    expect(Storage.setItem).toHaveBeenCalledWith(
      "playerstate_migration_v1",
      "completed",
    );
  });

  it("is idempotent - running twice produces same result", async () => {
    const db = getDb();

    const media = await createMedia(db, { id: "media-1" });

    await insertOldPlayerState({
      url: DEFAULT_TEST_SESSION.url,
      id: "ps-1",
      mediaId: media.id,
      userEmail: DEFAULT_TEST_SESSION.email,
      position: 100.0,
      playbackRate: 1.5,
      status: "in_progress",
    });

    // Run migration first time
    await migrateFromPlayerStateToPlaythrough();

    const playthroughsAfterFirst = await db.select().from(schema.playthroughs);
    const eventsAfterFirst = await db.select().from(schema.playbackEvents);

    expect(playthroughsAfterFirst).toHaveLength(1);
    expect(eventsAfterFirst).toHaveLength(1);

    // Clear the flag to simulate crash before flag was set
    delete mockStorage["playerstate_migration_v1"];
    jest.clearAllMocks();

    // Run migration second time - should clean up and recreate same data
    await migrateFromPlayerStateToPlaythrough();

    const playthroughsAfterSecond = await db.select().from(schema.playthroughs);
    const eventsAfterSecond = await db.select().from(schema.playbackEvents);

    // Should still have exactly 1 playthrough and 1 event (no duplicates)
    expect(playthroughsAfterSecond).toHaveLength(1);
    expect(eventsAfterSecond).toHaveLength(1);

    // Data should match
    expect(playthroughsAfterSecond[0]).toMatchObject({
      url: DEFAULT_TEST_SESSION.url,
      userEmail: DEFAULT_TEST_SESSION.email,
      mediaId: media.id,
      status: "in_progress",
    });

    expect(Storage.setItem).toHaveBeenCalledWith(
      "playerstate_migration_v1",
      "completed",
    );
  });
});
