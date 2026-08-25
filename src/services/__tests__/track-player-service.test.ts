/**
 * Tests for track-player-service.ts
 *
 * Uses Detroit-style testing: we mock only:
 * - Native modules (react-native-track-player via jest-setup.ts)
 *
 * The real track-player store, database code, and service logic runs.
 */

import { act, renderHook } from "@testing-library/react-native";
import { getPlaythroughWithMedia } from "@/db/playthroughs";
import * as trackPlayerService from "@/services/track-player-service";
import {
  PlayPauseSource,
  PlayPauseType,
  resetForTesting as resetTrackPlayerStore,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createDownload,
  createMedia,
  createMediaTrack,
  createPlaythrough,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockTrackPlayerPause,
  mockTrackPlayerPlay,
  mockTrackPlayerSeekTo,
  mockTrackPlayerSetupPlayer,
  resetTrackPlayerFake,
  trackPlayerFake,
} from "@test/jest-setup";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to create test data and get a PlaythroughWithMedia via the real query.
 * Uses factories for test data, then queries with getPlaythroughWithMedia.
 */
async function createTestPlaythrough(
  overrides: {
    position?: number;
    rate?: number;
    chapters?: {
      id: string;
      title: string;
      startTime: number;
      endTime: number | null;
    }[];
    downloaded?: boolean;
    duration?: string;
  } = {},
) {
  const db = getDb();

  const chapters = overrides.chapters ?? [
    { id: "ch-1", title: "Chapter 1", startTime: 0, endTime: 100 },
    { id: "ch-2", title: "Chapter 2", startTime: 100, endTime: 200 },
    { id: "ch-3", title: "Chapter 3", startTime: 200, endTime: null },
  ];

  const media = await createMedia(db, {
    duration: overrides.duration ?? "300.0",
    chapters,
    hlsPath: "/audio/test/hls.m3u8",
    mpdPath: "/audio/test/manifest.mpd",
  });

  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    status: "in_progress",
    position: overrides.position,
    playbackRate: overrides.rate,
  });

  if (overrides.downloaded) {
    await createDownload(db, { mediaId: media.id });
  }

  // Use the real query to get the PlaythroughWithMedia shape
  return getPlaythroughWithMedia(session, playthrough.id);
}

describe("track-player-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrackPlayerFake();
    resetTrackPlayerStore();
    // Fake starts empty - loadPlaythroughIntoPlayer will set up state naturally
    // via add() -> seekTo() -> setRate(), just like the real TrackPlayer
  });

  describe("initialize", () => {
    it("sets up player and marks store as initialized", async () => {
      expect(useTrackPlayer.getState().initialized).toBe(false);

      await trackPlayerService.initialize();

      expect(useTrackPlayer.getState().initialized).toBe(true);
    });

    it("skips initialization if already initialized", async () => {
      useTrackPlayer.setState({ initialized: true });

      await trackPlayerService.initialize();

      expect(mockTrackPlayerSetupPlayer).not.toHaveBeenCalled();
    });
  });

  describe("loadPlaythroughIntoPlayer", () => {
    it("loads playthrough and sets store state", async () => {
      const playthrough = await createTestPlaythrough({
        position: 50,
        rate: 1.5,
      });

      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const state = useTrackPlayer.getState();

      // Playthrough is loaded
      expect(state.playthrough).toEqual({
        id: playthrough.id,
        mediaId: playthrough.mediaId,
        status: "in_progress",
      });

      // Progress is set
      expect(state.progress.position).toBe(50);
      expect(state.progress.duration).toBe(300);

      // Playback rate is set
      expect(state.playbackRate).toBe(1.5);

      // Chapters are loaded
      expect(state.chapters).toHaveLength(3);

      // Current chapter is determined from position
      expect(state.currentChapter?.title).toBe("Chapter 1");

      // Streaming mode (no download)
      expect(state.streaming).toBe(true);
    });

    it("preserves playbackState from event listeners instead of resetting to None", async () => {
      // This test verifies the fix for a race condition where loadPlaythroughIntoPlayer
      // was overwriting playbackState to None at the end, even though TrackPlayer had
      // already fired events setting it to Ready. This caused the play button to show
      // a spinner on app boot.
      //
      // The fix: reset store state immediately after TrackPlayer.reset(), then let
      // event listeners manage playbackState as the track loads. Don't overwrite it
      // at the end.

      // Initialize the service to set up event listeners
      await trackPlayerService.initialize();

      const playthrough = await createTestPlaythrough({ position: 0 });

      // Load the playthrough - the fake emits a "ready" state event during add()
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const state = useTrackPlayer.getState();

      // The key assertion: the state came from the snapshot the fake emitted
      // during add() and is NOT idle (which would indicate the race
      // condition bug).
      expect(state.state).toBe("ready");
    });

    it("sets streaming to false when media is downloaded", async () => {
      const playthrough = await createTestPlaythrough({
        downloaded: true,
      });

      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      expect(useTrackPlayer.getState().streaming).toBe(false);
    });

    // The back-catalogue reclaim relinks a legacy recording to its original
    // files and gives it tracks. Everyone already holding a download of it has
    // a perfectly good copy of the same book on disk, keyed to nothing the new
    // tracks mention.
    describe("a downloaded recording that has since gained tracks", () => {
      async function downloadedThenRelinked() {
        const db = getDb();
        const media = await createMedia(db, {
          duration: "300.0",
          hlsPath: "/audio/test/hls.m3u8",
          mpdPath: "/audio/test/manifest.mpd",
        });
        // Downloaded while it was still legacy: one packaged file, no per-track
        // files, because there were no tracks to key them to.
        await createDownload(db, {
          mediaId: media.id,
          filePath: "legacy-download.mp4",
        });
        // Relinked since: two files it has never been told about.
        await createMediaTrack(db, {
          mediaId: media.id,
          index: 0,
          startOffset: 0,
          duration: 100,
          path: "/library/a.mp3",
        });
        await createMediaTrack(db, {
          mediaId: media.id,
          index: 1,
          startOffset: 100,
          duration: 200,
          path: "/library/b.mp3",
        });
        const playthrough = await createPlaythrough(db, {
          mediaId: media.id,
          status: "in_progress",
        });
        return getPlaythroughWithMedia(session, playthrough.id);
      }

      it("keeps playing the downloaded file instead of streaming the tracks", async () => {
        const playthrough = await downloadedThenRelinked();

        await trackPlayerService.loadPlaythroughIntoPlayer(
          session,
          playthrough,
        );

        const queue = trackPlayerFake.getState().queue as { url: string }[];
        expect(queue).toHaveLength(1);
        expect(queue[0]!.url).toContain("legacy-download.mp4");
        expect(useTrackPlayer.getState().streaming).toBe(false);
      });

      // The queue and the timeline describe the same thing and are wrong
      // apart: a two-file timeline over a one-file queue would translate a
      // position past 100s into a skip to a track the player does not have.
      it("reports position against the whole file, not the track timeline", async () => {
        const playthrough = await downloadedThenRelinked();

        await trackPlayerService.loadPlaythroughIntoPlayer(
          session,
          playthrough,
        );
        await trackPlayerService.seekTo(150, SeekSource.SCRUBBER);

        const { position } = trackPlayerFake.getState();
        expect(position).toBe(150);
      });
    });

    // The mirror image, and the reason the fallback is narrow: per-track local
    // files are keyed by track id so that a re-scan invalidates them rather
    // than mapping playback onto the wrong file. Guessing an order would be
    // exactly that mistake, so this one streams.
    it("streams a direct-play recording whose downloaded files no longer match its tracks", async () => {
      const db = getDb();
      const media = await createMedia(db, { duration: "300.0" });
      await createMediaTrack(db, {
        mediaId: media.id,
        index: 0,
        startOffset: 0,
        duration: 300,
        path: "/library/new.mp3",
      });
      // A direct-play download carries no `filePath`; its files name track ids
      // that a re-scan has since replaced.
      await createDownload(db, {
        mediaId: media.id,
        filePath: "",
        files: [{ trackId: "a-track-that-no-longer-exists", path: "old.mp3" }],
      });
      const playthrough = await createPlaythrough(db, {
        mediaId: media.id,
        status: "in_progress",
      });

      await trackPlayerService.loadPlaythroughIntoPlayer(
        session,
        (await getPlaythroughWithMedia(session, playthrough.id))!,
      );

      const queue = trackPlayerFake.getState().queue as { url: string }[];
      expect(queue).toHaveLength(1);
      expect(queue[0]!.url).toContain("/library/new.mp3");
      expect(queue[0]!.url).not.toContain("old.mp3");
    });

    it("never reports an empty player while swapping one book for another", async () => {
      // The UI mounts the player on this field, so a moment without a
      // playthrough is a moment without a player: the loading screen vanishes,
      // the screen behind it comes back, and the player pops in again when the
      // load finishes. Loading is allowed to take as long as it takes; what it
      // may not do is unmount the player while it does.
      await trackPlayerService.initialize();

      const first = await createTestPlaythrough({ position: 10 });
      const second = await createTestPlaythrough({ position: 20 });

      await trackPlayerService.loadPlaythroughIntoPlayer(session, first);

      const seen: (string | undefined)[] = [];
      const unsubscribe = useTrackPlayer.subscribe((state) =>
        seen.push(state.playthrough?.id),
      );

      await trackPlayerService.loadPlaythroughIntoPlayer(session, second);
      unsubscribe();

      expect(seen).not.toHaveLength(0);
      expect(seen).not.toContain(undefined);
      expect(seen.at(-1)).toBe(second.id);
    });
  });

  describe("play", () => {
    it("emits play event with correct state", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.play(PlayPauseSource.USER);

      const state = useTrackPlayer.getState();
      expect(state.lastPlayPause).not.toBeNull();
      expect(state.lastPlayPause?.type).toBe(PlayPauseType.PLAY);
      expect(state.lastPlayPause?.source).toBe(PlayPauseSource.USER);
      expect(state.lastPlayPause?.playthroughId).toBe(playthrough.id);
      expect(state.lastPlayPause?.position).toBe(50);
    });

    it("does nothing when no playthrough is loaded", async () => {
      await trackPlayerService.play(PlayPauseSource.USER);

      expect(mockTrackPlayerPlay).not.toHaveBeenCalled();
      expect(useTrackPlayer.getState().lastPlayPause).toBeNull();
    });
  });

  describe("pause", () => {
    it("emits pause event with correct state", async () => {
      const playthrough = await createTestPlaythrough({ position: 75 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.pause(PlayPauseSource.USER);

      const state = useTrackPlayer.getState();
      expect(state.lastPlayPause).not.toBeNull();
      expect(state.lastPlayPause?.type).toBe(PlayPauseType.PAUSE);
      expect(state.lastPlayPause?.source).toBe(PlayPauseSource.USER);
    });

    it("rewinds after pause when rewindSeconds provided", async () => {
      const playthrough = await createTestPlaythrough({ position: 100 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.pause(PlayPauseSource.SLEEP_TIMER, 10);

      // Should have rewound 10 seconds (at rate 1.0)
      expect(useTrackPlayer.getState().progress.position).toBe(90);
    });

    it("rewinds accounting for playback rate", async () => {
      const playthrough = await createTestPlaythrough({
        position: 100,
        rate: 2.0,
      });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.pause(PlayPauseSource.SLEEP_TIMER, 10);

      // Should have rewound 20 seconds (10 * rate 2.0)
      expect(useTrackPlayer.getState().progress.position).toBe(80);
    });

    it("does nothing when no playthrough is loaded", async () => {
      await trackPlayerService.pause(PlayPauseSource.USER);

      expect(mockTrackPlayerPause).not.toHaveBeenCalled();
      expect(useTrackPlayer.getState().lastPlayPause).toBeNull();
    });
  });

  describe("pauseIfPlaying", () => {
    it("pauses when currently playing", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // Simulate playing state
      useTrackPlayer.setState({
        isPlaying: { playing: true, bufferingDuringPlay: false },
      });

      await trackPlayerService.pauseIfPlaying(PlayPauseSource.USER);

      // Pause event should be recorded
      expect(useTrackPlayer.getState().lastPlayPause?.type).toBe(
        PlayPauseType.PAUSE,
      );
    });

    it("does nothing when not playing", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // Ensure not playing (default state)
      useTrackPlayer.setState({
        isPlaying: { playing: false, bufferingDuringPlay: false },
      });

      await trackPlayerService.pauseIfPlaying(PlayPauseSource.USER);

      // No pause event should be recorded
      expect(useTrackPlayer.getState().lastPlayPause).toBeNull();
    });
  });

  describe("seekTo", () => {
    it("updates store with lastSeek event", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.seekTo(150, SeekSource.SCRUBBER);

      const state = useTrackPlayer.getState();
      expect(state.lastSeek).not.toBeNull();
      expect(state.lastSeek?.source).toBe(SeekSource.SCRUBBER);
      expect(state.lastSeek?.from).toBe(50);
      expect(state.lastSeek?.to).toBe(150);
      expect(state.lastSeek?.playthroughId).toBe(playthrough.id);
    });

    it("updates progress after seeking", async () => {
      // Start at 0
      const playthrough = await createTestPlaythrough();
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // seekTo will automatically update fake position to 200
      await trackPlayerService.seekTo(200, SeekSource.BUTTON);

      const state = useTrackPlayer.getState();
      expect(state.progress.position).toBe(200);
      expect(state.progress.percent).toBeCloseTo(66.67, 1);
    });

    it("updates current chapter when seeking to different chapter", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 1");

      // seekTo will automatically update fake position to 150
      await trackPlayerService.seekTo(150, SeekSource.CHAPTER);

      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 2");
      expect(useTrackPlayer.getState().previousChapter?.title).toBe(
        "Chapter 1",
      );
    });

    it("does nothing when no playthrough is loaded", async () => {
      mockTrackPlayerSeekTo.mockClear();

      await trackPlayerService.seekTo(100, SeekSource.BUTTON);

      // Should not call TrackPlayer.seekTo
      expect(mockTrackPlayerSeekTo).not.toHaveBeenCalled();
      // State should be unchanged
      expect(useTrackPlayer.getState().lastSeek).toBeNull();
    });
  });

  describe("when the player loses its track (streaming failure)", () => {
    // A streaming player that errors out or drops its item after a network
    // failure reports zeroed progress. These tests simulate that by zeroing
    // the fake's position and duration after a successful load.

    afterEach(() => {
      jest.useRealTimers();
    });

    it("getAccurateProgress falls back to the last-known progress", async () => {
      const playthrough = await createTestPlaythrough({ position: 150 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // The player loses its track and starts reporting zeros
      trackPlayerFake.setState({ position: 0, duration: 0 });

      jest.useFakeTimers();
      const progressPromise = trackPlayerService.getAccurateProgress();
      await jest.advanceTimersByTimeAsync(10_000);
      const progress = await progressPromise;

      expect(progress.position).toBe(150);
      expect(progress.duration).toBe(300);
    });

    it("seekTo records the requested position and preserves store progress", async () => {
      const playthrough = await createTestPlaythrough({ position: 150 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // The player loses its track and starts reporting zeros
      trackPlayerFake.setState({ position: 0, duration: 0 });

      jest.useFakeTimers();
      const seekPromise = trackPlayerService.seekTo(140, SeekSource.BUTTON);
      await jest.advanceTimersByTimeAsync(60_000);
      await seekPromise;

      const { lastSeek, progress } = useTrackPlayer.getState();

      // The event records the seek the user asked for, not player-reported
      // garbage - previously this recorded a destructive "seek to 0"
      expect(lastSeek?.from).toBe(150);
      expect(lastSeek?.to).toBe(140);

      // The store's progress is not poisoned by the dead player's zeros
      expect(progress.position).toBe(150);
      expect(progress.duration).toBe(300);
    });
  });

  describe("setPlaybackRate", () => {
    it("updates rate and emits lastRateChange", async () => {
      const playthrough = await createTestPlaythrough({ position: 50 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.setPlaybackRate(1.5);

      const state = useTrackPlayer.getState();
      expect(state.playbackRate).toBe(1.5);
      expect(state.lastRateChange).not.toBeNull();
      expect(state.lastRateChange?.previousRate).toBe(1.0);
      expect(state.lastRateChange?.newRate).toBe(1.5);
      expect(state.lastRateChange?.playthroughId).toBe(playthrough.id);
    });

    it("sets lastRateChange to null when no playthrough loaded", async () => {
      // setPlaybackRate will automatically update fake rate
      await trackPlayerService.setPlaybackRate(2.0);

      const state = useTrackPlayer.getState();
      expect(state.playbackRate).toBe(2.0);
      expect(state.lastRateChange).toBeNull();
    });
  });

  describe("state queries", () => {
    it("getLoadedPlaythrough returns current playthrough", async () => {
      expect(trackPlayerService.getLoadedPlaythrough()).toBeUndefined();

      // Default position 0
      const playthrough = await createTestPlaythrough();
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const loaded = trackPlayerService.getLoadedPlaythrough();
      expect(loaded?.id).toBe(playthrough.id);
      expect(loaded?.mediaId).toBe(playthrough.mediaId);
    });

    it("getProgress returns progress from store", async () => {
      const playthrough = await createTestPlaythrough({ position: 123 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const progress = trackPlayerService.getProgress();
      expect(progress.position).toBe(123);
      expect(progress.duration).toBe(300);
    });

    it("getAccurateProgress returns fresh progress from TrackPlayer", async () => {
      // First set up some store state
      useTrackPlayer.setState({
        progress: { position: 100, duration: 300, buffered: 0, percent: 33.33 },
      });

      // Fake returns different value
      trackPlayerFake.setState({ position: 150, duration: 300 });

      const progress = await trackPlayerService.getAccurateProgress();
      expect(progress.position).toBe(150);
    });

    it("getCurrentChapter returns current chapter from store", async () => {
      const playthrough = await createTestPlaythrough({ position: 150 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const chapter = trackPlayerService.getCurrentChapter();
      expect(chapter?.title).toBe("Chapter 2");
    });

    it("getPreviousChapter returns previous chapter from store", async () => {
      const playthrough = await createTestPlaythrough({ position: 150 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const chapter = trackPlayerService.getPreviousChapter();
      expect(chapter?.title).toBe("Chapter 1");
    });

    it("getPlaybackRate returns rate from store", async () => {
      useTrackPlayer.setState({ playbackRate: 1.75 });

      expect(trackPlayerService.getPlaybackRate()).toBe(1.75);
    });

    it("isPlaying returns isPlaying state from store", async () => {
      useTrackPlayer.setState({
        isPlaying: { playing: true, bufferingDuringPlay: false },
      });

      const result = trackPlayerService.isPlaying();
      expect(result.playing).toBe(true);
      expect(result.bufferingDuringPlay).toBe(false);
    });
  });

  describe("unload", () => {
    it("resets store to initial state", async () => {
      const playthrough = await createTestPlaythrough({ position: 100 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      // Verify state is set
      expect(useTrackPlayer.getState().playthrough).toBeDefined();
      expect(useTrackPlayer.getState().chapters.length).toBeGreaterThan(0);

      await trackPlayerService.unload();

      const state = useTrackPlayer.getState();
      expect(state.playthrough).toBeUndefined();
      expect(state.chapters).toEqual([]);
      expect(state.currentChapter).toBeNull();
      expect(state.progress.position).toBe(0);
    });
  });

  describe("chapter navigation", () => {
    it("handles media with no chapters", async () => {
      // No chapters, position doesn't matter for chapter lookup
      const playthrough = await createTestPlaythrough({
        chapters: [],
        position: 50,
      });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      const state = useTrackPlayer.getState();
      expect(state.chapters).toEqual([]);
      expect(state.currentChapter).toBeNull();
      expect(state.previousChapter).toBeNull();
    });

    it("sets previousChapter to null for first chapter", async () => {
      const playthrough = await createTestPlaythrough({ position: 10 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 1");
      expect(useTrackPlayer.getState().previousChapter).toBeNull();
    });

    it("correctly identifies last chapter (with null endTime)", async () => {
      const playthrough = await createTestPlaythrough({ position: 250 });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 3");
      expect(useTrackPlayer.getState().previousChapter?.title).toBe(
        "Chapter 2",
      );
    });
  });

  describe("play/pause event sources", () => {
    it("records USER source correctly", async () => {
      const playthrough = await createTestPlaythrough();
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.play(PlayPauseSource.USER);
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.USER,
      );

      await trackPlayerService.pause(PlayPauseSource.USER);
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.USER,
      );
    });

    it("records REMOTE source correctly", async () => {
      const playthrough = await createTestPlaythrough();
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.play(PlayPauseSource.REMOTE);
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.REMOTE,
      );
    });

    it("records SLEEP_TIMER source correctly", async () => {
      const playthrough = await createTestPlaythrough();
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      await trackPlayerService.pause(PlayPauseSource.SLEEP_TIMER);
      expect(useTrackPlayer.getState().lastPlayPause?.source).toBe(
        PlayPauseSource.SLEEP_TIMER,
      );
    });
  });

  describe("useDisplayProgress", () => {
    it("advances the displayed position at the playback rate", async () => {
      await trackPlayerService.initialize();
      const playthrough = await createTestPlaythrough({
        position: 100,
        rate: 2,
      });
      await trackPlayerService.loadPlaythroughIntoPlayer(session, playthrough);

      jest.useFakeTimers();
      await trackPlayerService.play(PlayPauseSource.USER);
      await jest.advanceTimersByTimeAsync(50);
      expect(useTrackPlayer.getState().isPlaying.playing).toBe(true);

      const { result, unmount } = renderHook(() =>
        trackPlayerService.useDisplayProgress(),
      );

      // One wall-clock second at 2x moves the book position ~2 seconds
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });
      expect(result.current.position).toBeGreaterThanOrEqual(101.5);
      expect(result.current.position).toBeLessThanOrEqual(102.5);

      unmount();
    });
  });

  describe("playback state initialization", () => {
    it("initializes with correct defaults", async () => {
      await trackPlayerService.initialize();

      const state = useTrackPlayer.getState();
      expect(state.initialized).toBe(true);
      expect(state.state).toBe("idle");
      expect(state.playWhenReady).toBe(false);
      expect(state.isPlaying.playing).toBe(false);
      expect(state.playbackRate).toBe(1.0);
    });
  });
});
