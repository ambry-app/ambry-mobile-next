/**
 * Tests for playback-service.ts
 *
 * Uses Detroit-style testing: only the native module is mocked (via
 * jest-setup.ts). The real store, database and service logic runs.
 *
 * These cover the remote-control handlers, which are the app's only route from
 * a headset or notification button to the player: the native module delivers
 * every transport command un-acted and waits for us to issue the real one.
 *
 * There is no play/pause *toggle* here any more. RNTP swallowed the headset's
 * KEYCODE_MEDIA_PLAY_PAUSE and made JS resolve it (the old RemotePlayPause
 * handler); media3's session resolves the toggle against `playWhenReady`
 * itself, so a headset key arrives as the play or the pause it meant.
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
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  audioPlayerFake,
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
 * Deliver a remote command the way the native module would: un-acted, as an
 * event. The handler chain it triggers is async, and the fake's own state
 * emissions land on a later tick, so flush twice before asserting.
 */
async function emitRemote(command: {
  command: string;
  [key: string]: unknown;
}) {
  audioPlayerFake.emitRemoteCommand(command);
  await flushNativeEvents();
  await flushNativeEvents();
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

    // Registers the remote-command handlers under test, the way entry.js does.
    await PlaybackService();
  });

  afterEach(() => {
    resetTrackPlayerService();
  });

  describe("remote play and pause", () => {
    it("plays on a remote play", async () => {
      await loadPlaythrough(50);

      expect(useTrackPlayer.getState().isPlaying.playing).toBe(false);

      await emitRemote({ command: "play" });

      expect(trackPlayerFake.getState().playbackState).toBe("playing");
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PLAY,
      );
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });

    it("pauses on a remote pause", async () => {
      const playthrough = await loadPlaythrough(50);

      await Player.play(PlayPauseSource.USER);
      await flushNativeEvents();
      expect(useTrackPlayer.getState().isPlaying.playing).toBe(true);

      await emitRemote({ command: "pause" });

      expect(trackPlayerFake.getState().playbackState).toBe("paused");

      const { lastPlayPause } = useTrackPlayer.getState();
      expect(lastPlayPause?.type).toBe(PlayPauseType.PAUSE);
      expect(lastPlayPause?.source).toBe(PlayPauseSource.REMOTE);
      expect(lastPlayPause?.playthroughId).toBe(playthrough.id);
    });

    it("rewinds on pause, like every other pause", async () => {
      // The whole reason the command arrives un-acted: the rewind must happen
      // at pause time, before the event log sees the pause, not be patched in
      // after a native pause already recorded the un-rewound position.
      await loadPlaythrough(100);

      await Player.play(PlayPauseSource.USER);
      await flushNativeEvents();

      await emitRemote({ command: "pause" });

      expect(useTrackPlayer.getState().progress.position).toBeLessThan(100);
    });
  });
});
