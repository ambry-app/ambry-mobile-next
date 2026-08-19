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
import {
  PlayPauseSource,
  PlayPauseType,
  resetForTesting as resetTrackPlayerStore,
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
  mockTrackPlayerPause,
  mockTrackPlayerPlay,
  resetTrackPlayerFake,
} from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Register the service and return the handler it attached for an event, so a
 * test can fire that event the way TrackPlayer would.
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
 * Create a playthrough and load it, so the player is in the state it would be
 * in with a book open.
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

function setPlaying(playing: boolean) {
  useTrackPlayer.setState({
    isPlaying: { playing, bufferingDuringPlay: false },
  });
}

describe("playback-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerStore();
  });

  describe("RemotePlayPause", () => {
    // A headset's play/pause key arrives as this event and nothing else: RNTP
    // maps KEYCODE_MEDIA_PLAY_PAUSE to it and reports the key handled, so
    // media3 never resolves the toggle into a play or a pause of its own.
    it("is handled at all", async () => {
      await expect(handlerFor(Event.RemotePlayPause)).resolves.toBeDefined();
    });

    it("pauses when playing", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      const playthrough = await loadPlaythrough(50);
      setPlaying(true);

      await handler();

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(mockTrackPlayerPlay).not.toHaveBeenCalled();

      const { lastPlayPause } = useTrackPlayer.getState();
      expect(lastPlayPause?.type).toBe(PlayPauseType.PAUSE);
      expect(lastPlayPause?.source).toBe(PlayPauseSource.REMOTE);
      expect(lastPlayPause?.playthroughId).toBe(playthrough.id);
    });

    it("plays when paused", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      await loadPlaythrough(50);
      setPlaying(false);

      await handler();

      expect(mockTrackPlayerPlay).toHaveBeenCalled();
      expect(mockTrackPlayerPause).not.toHaveBeenCalled();

      const { lastPlayPause } = useTrackPlayer.getState();
      expect(lastPlayPause?.type).toBe(PlayPauseType.PLAY);
      expect(lastPlayPause?.source).toBe(PlayPauseSource.REMOTE);
    });

    it("rewinds on pause, like every other pause", async () => {
      const handler = await handlerFor(Event.RemotePlayPause);
      await loadPlaythrough(100);
      setPlaying(true);

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

      expect(mockTrackPlayerPlay).toHaveBeenCalled();
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });

    it("pauses on RemotePause", async () => {
      const handler = await handlerFor(Event.RemotePause);
      await loadPlaythrough(50);

      await handler();

      expect(mockTrackPlayerPause).toHaveBeenCalled();
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });
  });
});
