/**
 * Tests for position-heartbeat.ts
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (react-native-track-player via jest-setup.ts)
 *
 * The real track-player store, database code, and service logic runs.
 */

import { eq } from "drizzle-orm";

import { getPlaythroughWithMedia } from "@/db/playthroughs";
import * as schema from "@/db/schema";
import { saveNow } from "@/services/position-heartbeat";
import * as trackPlayerService from "@/services/track-player-service";
import {
  resetForTesting as resetTrackPlayerStore,
  SeekSource,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { resetTrackPlayerFake } from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

async function getCachedPosition(playthroughId: string) {
  const db = getDb();
  const cache = await db.query.playthroughStateCache.findFirst({
    where: eq(schema.playthroughStateCache.playthroughId, playthroughId),
  });
  return cache?.position;
}

describe("position-heartbeat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("saveNow", () => {
    it("does nothing when no playthrough is loaded", async () => {
      await expect(saveNow()).resolves.toBeUndefined();
    });

    it("saves the current position to the state cache", async () => {
      const db = getDb();
      const media = await createMedia(db, { duration: "300.0" });
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        position: 150,
      });
      const playthroughWithMedia = await getPlaythroughWithMedia(
        session,
        playthrough.id,
      );

      await trackPlayerService.loadPlaythroughIntoPlayer(
        session,
        playthroughWithMedia,
      );
      await trackPlayerService.seekTo(200, SeekSource.INTERNAL);

      await saveNow();

      expect(await getCachedPosition(playthrough.id)).toBe(200);
    });

    it("does not overwrite the cached position with invalid progress", async () => {
      const db = getDb();
      // Media with unknown duration: the player never reports a valid
      // duration, so store progress stays invalid (duration 0) - the same
      // shape a dead streaming player produces.
      const media = await createMedia(db, { duration: null });
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        position: 150,
        cachePosition: 150,
      });
      const playthroughWithMedia = await getPlaythroughWithMedia(
        session,
        playthrough.id,
      );

      jest.useFakeTimers();
      const loadPromise = trackPlayerService.loadPlaythroughIntoPlayer(
        session,
        playthroughWithMedia,
      );
      await jest.advanceTimersByTimeAsync(60_000);
      await loadPromise;

      await saveNow();

      // The cached position survives instead of being zeroed
      expect(await getCachedPosition(playthrough.id)).toBe(150);
    });
  });
});
