/**
 * Tests for playback-service.ts
 *
 * Uses Detroit-style testing: only the native module is mocked (via
 * jest-setup.ts). The real store, database and service logic runs.
 *
 * These cover the remote-control handlers, which are the app's only route from
 * a headset or notification button to the player: RNTP's media session does
 * not touch the underlying player itself, it emits an event and waits for us
 * to issue the command.
 */

import { getPlaythroughWithMedia } from "@/db/playthroughs";
import { PlaybackService } from "@/services/playback-service";
import * as Player from "@/services/track-player-service";
import { resetForTesting as resetTrackPlayerService } from "@/services/track-player-service";
import {
  PlayPauseSource,
  PlayPauseType,
  useTrackPlayer,
} from "@/stores/track-player";
import { Event } from "@/types/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockTrackPlayerAddEventListener,
  resetTrackPlayerFake,
  trackPlayerFake,
} from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * The native mock emits its events on a later tick, as the real module does.
 */
function flushNativeEvents() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Register the service and return the handler it attached for an event, so a
 * test can fire it the way TrackPlayer would. There is no public way to emit
 * an arbitrary event through the fake, and these handlers are the contract
 * this file is about.
 */
async function handlerFor(event: Event) {
  await PlaybackService();

  const registration = mockTrackPlayerAddEventListener.mock.calls.find(
    ([registered]) => registered === event,
  );

  if (!registration) {
    throw new Error(`PlaybackService registered no handler for ${event}`);
  }

  // The mock types handlers as taking a payload and returning void. These take
  // no payload and are async, and the tests need to await what they do.
  return registration[1] as unknown as () => Promise<void>;
}

/**
 * Create a playthrough and load it through the real service, leaving the
 * player in the state it would be in with a book open and paused.
 */
async function loadPlaythrough(position: number) {
  const db = getDb();

  const media = await createMedia(db, {
    duration: "300.0",
    chapters: [{ id: "ch-1", title: "Chapter 1", startTime: 0, endTime: null }],
    hlsPath: "/audio/test/hls.m3u8",
    mpdPath: "/audio/test/manifest.mpd",
  });

  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    status: "in_progress",
    position,
  });

  const withMedia = await getPlaythroughWithMedia(session, playthrough.id);
  await Player.loadPlaythroughIntoPlayer(session, withMedia);

  return withMedia;
}

describe("playback-service", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerService();

    // Registers the listeners that keep isPlaying in step with the player, so
    // the toggle below reads the state the real app would read.
    await Player.initialize();
  });

  afterEach(() => {
    resetTrackPlayerService();
  });

  describe("RemotePlayPause", () => {
    // A headset's play/pause key arrives as this event and nothing else: RNTP
    // maps KEYCODE_MEDIA_PLAY_PAUSE to it and reports the key handled, so
    // media3 never resolves the toggle into a play or a pause of its own.
    it("is subscribed to at all", async () => {
      await expect(handlerFor(Event.RemotePlayPause)).resolves.toBeDefined();
    });

    it("pauses when playing", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      const playthrough = await loadPlaythrough(50);

      await Player.play(PlayPauseSource.USER);
      await flushNativeEvents();
      expect(useTrackPlayer.getState().isPlaying.playing).toBe(true);

      await handler();

      expect(trackPlayerFake.getState().playbackState).toBe("paused");

      const { lastPlayPause } = useTrackPlayer.getState();
      expect(lastPlayPause?.type).toBe(PlayPauseType.PAUSE);
      expect(lastPlayPause?.source).toBe(PlayPauseSource.REMOTE);
      expect(lastPlayPause?.playthroughId).toBe(playthrough.id);
    });

    it("plays when paused", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      await loadPlaythrough(50);

      expect(useTrackPlayer.getState().isPlaying.playing).toBe(false);

      await handler();

      expect(trackPlayerFake.getState().playbackState).toBe("playing");

      const { lastPlayPause } = useTrackPlayer.getState();
      expect(lastPlayPause?.type).toBe(PlayPauseType.PLAY);
      expect(lastPlayPause?.source).toBe(PlayPauseSource.REMOTE);
    });

    it("rewinds on pause, like every other pause", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      await loadPlaythrough(100);

      await Player.play(PlayPauseSource.USER);
      await flushNativeEvents();

      await handler();

      expect(useTrackPlayer.getState().progress.position).toBeLessThan(100);
    });
  });

  describe("RemotePlay and RemotePause", () => {
    // The notification's buttons take the other route, through the media
    // session, and arrive as these.
    it("plays on RemotePlay", async () => {
      const handler = await handlerFor(Event.RemotePlay);
      await loadPlaythrough(50);

      await handler();

      expect(trackPlayerFake.getState().playbackState).toBe("playing");
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PLAY,
      );
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });

    it("pauses on RemotePause", async () => {
      const handler = await handlerFor(Event.RemotePause);
      await loadPlaythrough(50);

      await Player.play(PlayPauseSource.USER);
      await flushNativeEvents();

      await handler();

      expect(trackPlayerFake.getState().playbackState).toBe("paused");
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PAUSE,
      );
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });
  });
});
