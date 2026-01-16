/**
 * Tests for playback-controls.ts
 *
 * Uses Detroit-style testing:
 * - Real database (test in-memory SQLite)
 * - Real services (track-player-service, playthrough-operations, event-recording)
 * - Mock only native modules (react-native-track-player via jest-setup.ts)
 * - Mock fetch for sync operations
 * - Fake timers for UI animation waits
 */

import { PLAYER_EXPAND_ANIMATION_DURATION } from "@/constants";
import {
  getActivePlaythroughIdForDevice,
  setActivePlaythroughIdForDevice,
} from "@/db/playthroughs";
import * as playbackControls from "@/services/playback-controls";
import {
  resetForTesting as resetDataVersionStore,
  useDataVersion,
} from "@/stores/data-version";
import {
  resetForTesting as resetDeviceStore,
  useDevice,
} from "@/stores/device";
import {
  resetForTesting as resetPlayerUIStore,
  usePlayerUIState,
} from "@/stores/player-ui-state";
import {
  resetForTesting as resetSessionStore,
  useSession,
} from "@/stores/session";
import {
  PlayPauseType,
  resetForTesting as resetTrackPlayerStore,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createLocalUserSettings,
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { installFetchMock, mockGraphQL } from "@test/fetch-mock";
import { resetTrackPlayerFake } from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to set up session and device stores.
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

/**
 * Helper to create a full playthrough setup with book, media, and playthrough.
 */
async function createFullPlaythroughSetup(
  options: {
    position?: number;
    rate?: number;
    status?: "in_progress" | "finished" | "abandoned";
    duration?: string;
  } = {},
) {
  const db = getDb();

  const book = await createBook(db, { title: "Test Book" });
  const media = await createMedia(db, {
    bookId: book.id,
    duration: options.duration ?? "300.0",
    chapters: [{ id: "ch-1", title: "Chapter 1", startTime: 0, endTime: null }],
    hlsPath: "/audio/test/hls.m3u8",
    mpdPath: "/audio/test/manifest.mpd",
  });
  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    status: options.status ?? "in_progress",
    position: options.position,
    rate: options.rate,
  });

  // Create user settings for active playthrough storage
  await createLocalUserSettings(db);

  return { book, media, playthrough };
}

describe("playback-controls", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerStore();
    resetSessionStore();
    resetDeviceStore();
    resetPlayerUIStore();
    resetDataVersionStore();
    setupSessionAndDevice();

    // Mock fetch for sync operations
    const mockFetch = installFetchMock();
    mockGraphQL(mockFetch, {
      data: { syncProgress: { playthroughs: [], events: [] } },
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("initializePlayer", () => {
    it("marks player as initialized", async () => {
      expect(usePlayerUIState.getState().initialized).toBe(false);

      await playbackControls.initializePlayer(session);

      expect(usePlayerUIState.getState().initialized).toBe(true);
    });

    it("skips if already initialized", async () => {
      usePlayerUIState.setState({ initialized: true });

      await playbackControls.initializePlayer(session);

      // Should not throw or change anything
      expect(usePlayerUIState.getState().initialized).toBe(true);
    });

    it("loads active playthrough if stored", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // Set this as the active playthrough for device
      await setActivePlaythroughIdForDevice(session, playthrough.id);

      await playbackControls.initializePlayer(session);

      // Player should have loaded the playthrough
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });
  });

  describe("continueExistingPlaythrough", () => {
    it("loads playthrough and starts playback", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 100,
        status: "in_progress",
      });

      // Start the operation without awaiting
      const operationPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );

      // Run all timers and await the operation
      await jest.runAllTimersAsync();
      await operationPromise;

      // Playthrough should be loaded
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);

      // Should have triggered play
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PLAY,
      );
    });

    it("expands player UI", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      const operationPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      expect(usePlayerUIState.getState().pendingExpandPlayer).toBe(true);
    });

    it("stores playthrough as active for device", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      const operationPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      const activeId = await getActivePlaythroughIdForDevice(session);
      expect(activeId).toBe(playthrough.id);
    });
  });

  describe("startFreshPlaythrough", () => {
    it("creates new playthrough and starts playback", async () => {
      const { media } = await createFullPlaythroughSetup();

      // Start fresh for the media (will create a new playthrough)
      const operationPromise = playbackControls.startFreshPlaythrough(
        session,
        media.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      // A playthrough should be loaded (new one, not the existing one)
      const loadedPlaythrough = useTrackPlayer.getState().playthrough;
      expect(loadedPlaythrough).toBeDefined();
      expect(loadedPlaythrough?.mediaId).toBe(media.id);

      // Should have triggered play
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PLAY,
      );
    });

    it("records start event for new playthrough", async () => {
      const { media } = await createFullPlaythroughSetup();

      const operationPromise = playbackControls.startFreshPlaythrough(
        session,
        media.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      // Check that a start event was recorded
      const db = getDb();
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.type, "start"),
      });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("resumeAndLoadPlaythrough", () => {
    it("resumes finished playthrough and starts playback", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        status: "finished",
        position: 100,
      });

      const operationPromise = playbackControls.resumeAndLoadPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      // Playthrough should be loaded
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);

      // Should have triggered play
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PLAY,
      );
    });

    it("records resume event", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        status: "abandoned",
      });

      const operationPromise = playbackControls.resumeAndLoadPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await operationPromise;

      // Check that a resume event was recorded
      const db = getDb();
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.type, "resume"),
      });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("finishPlaythrough", () => {
    it("records finish event and updates status", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      await playbackControls.finishPlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Check finish event was recorded
      const db = getDb();
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.type, "finish"),
      });
      expect(events.length).toBeGreaterThan(0);

      // Check status was updated
      const updated = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthrough.id),
      });
      expect(updated?.status).toBe("finished");
    });

    it("unloads player when playthrough is loaded", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);

      // Now finish it
      await playbackControls.finishPlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Player should be unloaded
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });

    it("does not unload when skipUnload option is true", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Finish with skipUnload
      await playbackControls.finishPlaythrough(session, playthrough.id, {
        skipUnload: true,
      });
      await jest.runAllTimersAsync();

      // Player should still have playthrough
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });
  });

  describe("abandonPlaythrough", () => {
    it("records abandon event and updates status", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      await playbackControls.abandonPlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Check abandon event was recorded
      const db = getDb();
      const events = await db.query.playbackEvents.findMany({
        where: (e, { eq }) => eq(e.type, "abandon"),
      });
      expect(events.length).toBeGreaterThan(0);

      // Check status was updated
      const updated = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthrough.id),
      });
      expect(updated?.status).toBe("abandoned");
    });

    it("unloads player when playthrough is loaded", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Now abandon it
      await playbackControls.abandonPlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Player should be unloaded
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });
  });

  describe("deletePlaythrough", () => {
    it("deletes playthrough from database", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      await playbackControls.deletePlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Check playthrough was soft deleted
      const db = getDb();
      const deleted = await db.query.playthroughs.findFirst({
        where: (p, { eq }) => eq(p.id, playthrough.id),
      });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it("unloads player when playthrough is loaded", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Now delete it
      await playbackControls.deletePlaythrough(session, playthrough.id);
      await jest.runAllTimersAsync();

      // Player should be unloaded
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });
  });

  describe("unloadPlaythrough", () => {
    it("clears active playthrough and unloads player", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Verify active is set
      let activeId = await getActivePlaythroughIdForDevice(session);
      expect(activeId).toBe(playthrough.id);

      // Unload
      await playbackControls.unloadPlaythrough(session);
      await jest.runAllTimersAsync();

      // Player should be unloaded
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();

      // Active should be cleared
      activeId = await getActivePlaythroughIdForDevice(session);
      expect(activeId).toBeNull();
    });
  });

  describe("unloadPlayer", () => {
    it("unloads player but keeps active playthrough", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });

      // First load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Unload player only
      await playbackControls.unloadPlayer();
      await jest.runAllTimersAsync();

      // Player should be unloaded
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();

      // But active should still be set
      const activeId = await getActivePlaythroughIdForDevice(session);
      expect(activeId).toBe(playthrough.id);
    });
  });

  describe("expandPlayerAndWait", () => {
    it("requests expand and waits for animation duration", async () => {
      const expandPromise = playbackControls.expandPlayerAndWait();

      // Should have requested expand immediately
      expect(usePlayerUIState.getState().pendingExpandPlayer).toBe(true);

      // Advance time by animation duration
      jest.advanceTimersByTime(PLAYER_EXPAND_ANIMATION_DURATION);

      await expandPromise;

      // Promise should resolve after animation duration
      expect(true).toBe(true); // If we get here, it resolved
    });
  });

  describe("reloadCurrentPlaythroughIfMedia", () => {
    it("reloads when media matches loaded playthrough", async () => {
      const { playthrough, media } = await createFullPlaythroughSetup({
        position: 100,
      });

      // Load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Reload for the same media
      const reloadPromise = playbackControls.reloadCurrentPlaythroughIfMedia(
        session,
        media.id,
      );
      await jest.runAllTimersAsync();
      await reloadPromise;

      // Should still be loaded (reloaded)
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });

    it("does nothing when media does not match", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 100,
      });

      // Load the playthrough
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Try to reload for different media
      const reloadPromise = playbackControls.reloadCurrentPlaythroughIfMedia(
        session,
        "different-media-id",
      );
      await jest.runAllTimersAsync();
      await reloadPromise;

      // Should still have original playthrough
      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });

    it("does nothing when no playthrough is loaded", async () => {
      const { media } = await createFullPlaythroughSetup();

      // Don't load any playthrough
      const reloadPromise = playbackControls.reloadCurrentPlaythroughIfMedia(
        session,
        media.id,
      );
      await jest.runAllTimersAsync();
      await reloadPromise;

      // Should still have no playthrough
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });
  });

  describe("applyPlaythroughAction", () => {
    it("handles unloadPlaythrough action", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        position: 50,
      });
      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      const actionPromise = playbackControls.applyPlaythroughAction(session, {
        type: "unloadPlaythrough",
      });
      await jest.runAllTimersAsync();
      await actionPromise;

      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });

    it("handles continueExistingPlaythrough action", async () => {
      const { playthrough } = await createFullPlaythroughSetup();

      const actionPromise = playbackControls.applyPlaythroughAction(session, {
        type: "continueExistingPlaythrough",
        playthroughId: playthrough.id,
      });
      await jest.runAllTimersAsync();
      await actionPromise;

      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });

    it("handles startFreshPlaythrough action", async () => {
      const { media } = await createFullPlaythroughSetup();

      const actionPromise = playbackControls.applyPlaythroughAction(session, {
        type: "startFreshPlaythrough",
        mediaId: media.id,
      });
      await jest.runAllTimersAsync();
      await actionPromise;

      expect(useTrackPlayer.getState().playthrough?.mediaId).toBe(media.id);
    });

    it("handles resumeAndLoadPlaythrough action", async () => {
      const { playthrough } = await createFullPlaythroughSetup({
        status: "finished",
      });

      const actionPromise = playbackControls.applyPlaythroughAction(session, {
        type: "resumeAndLoadPlaythrough",
        playthroughId: playthrough.id,
      });
      await jest.runAllTimersAsync();
      await actionPromise;

      expect(useTrackPlayer.getState().playthrough?.id).toBe(playthrough.id);
    });

    it("handles promptForResume action (no-op)", async () => {
      // This action is handled by UI, so it should be a no-op
      const actionPromise = playbackControls.applyPlaythroughAction(session, {
        type: "promptForResume",
        playthroughId: "some-id",
      });
      await jest.runAllTimersAsync();
      await actionPromise;

      // Nothing should have happened
      expect(useTrackPlayer.getState().playthrough).toBeUndefined();
    });
  });

  describe("data version bumping", () => {
    it("bumps playthrough data version on continueExistingPlaythrough", async () => {
      useDataVersion.setState({ playthroughDataVersion: 1 });
      const { playthrough } = await createFullPlaythroughSetup();

      const loadPromise = playbackControls.continueExistingPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await loadPromise;

      // Version should have been bumped (incremented)
      const newVersion = useDataVersion.getState().playthroughDataVersion;
      expect(newVersion).toBeGreaterThan(1);
    });

    it("bumps playthrough data version on finishPlaythrough", async () => {
      useDataVersion.setState({ playthroughDataVersion: 1 });
      const { playthrough } = await createFullPlaythroughSetup();

      const finishPromise = playbackControls.finishPlaythrough(
        session,
        playthrough.id,
      );
      await jest.runAllTimersAsync();
      await finishPromise;

      const newVersion = useDataVersion.getState().playthroughDataVersion;
      expect(newVersion).toBeGreaterThan(1);
    });
  });
});
