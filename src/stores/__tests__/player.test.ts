/**
 * Tests for the player store.
 *
 * Testing philosophy: Use real implementations wherever possible.
 * Only mock external native modules (TrackPlayer).
 */

import * as schema from "@/db/schema";
import { stopMonitoring } from "@/services/event-recording-service";
import { initialDeviceState, useDevice } from "@/stores/device";
import {
  cancelResumePrompt,
  checkForResumePrompt,
  expandPlayer,
  forceUnloadPlayer,
  handleResumePlaythrough,
  handleStartFresh,
  initializePlayer,
  loadMedia,
  pause,
  play,
  prepareToLoadMedia,
  seekRelative,
  SeekSource,
  seekTo,
  setPlaybackRate,
  skipToBeginningOfChapter,
  skipToEndOfChapter,
  tryUnloadPlayer,
  usePlayer,
} from "@/stores/player";
import { useSession } from "@/stores/session";
import { EventBus } from "@/utils/event-bus";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBookAuthor,
  createDownload,
  createMedia,
  createPlaythrough,
  createPlaythroughStateCache,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockTrackPlayerAdd,
  mockTrackPlayerGetProgress,
  mockTrackPlayerGetRate,
  mockTrackPlayerGetTrack,
  mockTrackPlayerPause,
  mockTrackPlayerPlay,
  mockTrackPlayerReset,
  mockTrackPlayerSeekTo,
  mockTrackPlayerSetRate,
  mockTrackPlayerSetupPlayer,
  mockTrackPlayerUpdateOptions,
} from "@test/jest-setup";

// Set up test database
const { getDb } = setupTestDatabase();

// Spy on EventBus.emit to verify events
const eventBusSpy = jest.spyOn(EventBus, "emit");

// Initial states for resetting between tests
const initialPlayerState = {
  initialized: false,
  initializationError: null,
  mediaId: null,
  streaming: undefined,
  loadingNewMedia: false,
  pendingResumePrompt: null,
  position: 0,
  duration: 0,
  playbackRate: 1,
  userIsSeeking: false,
  seekIsApplying: false,
  seekOriginalPosition: null,
  seekBasePosition: null,
  seekAccumulator: null,
  seekPosition: null,
  seekEffectiveDiff: null,
  seekEventFrom: null,
  seekEventTo: null,
  chapters: [],
  currentChapter: undefined,
  previousChapterStartTime: 0,
};

const initialSessionState = { session: null };

describe("player store", () => {
  beforeEach(() => {
    jest.useFakeTimers();

    // Reset store states
    usePlayer.setState(initialPlayerState);
    useSession.setState(initialSessionState);
    useDevice.setState(initialDeviceState);

    // Reset event recording service module state
    stopMonitoring();

    // Reset mocks
    mockTrackPlayerGetProgress.mockReset();
    mockTrackPlayerGetRate.mockReset();
    mockTrackPlayerSeekTo.mockReset();
    mockTrackPlayerPlay.mockReset();
    mockTrackPlayerPause.mockReset();
    mockTrackPlayerSetRate.mockReset();
    mockTrackPlayerReset.mockReset();
    mockTrackPlayerAdd.mockReset();
    mockTrackPlayerGetTrack.mockReset();
    mockTrackPlayerSetupPlayer.mockReset();
    mockTrackPlayerUpdateOptions.mockReset();
    eventBusSpy.mockClear();

    // Default mock values
    mockTrackPlayerGetTrack.mockResolvedValue(null); // No track loaded by default
    mockTrackPlayerAdd.mockResolvedValue(undefined);
    mockTrackPlayerSetupPlayer.mockResolvedValue(undefined);
    mockTrackPlayerUpdateOptions.mockResolvedValue(undefined);
    mockTrackPlayerGetProgress.mockResolvedValue({
      position: 100,
      duration: 3600,
    });
    mockTrackPlayerGetRate.mockResolvedValue(1.0);
    mockTrackPlayerSeekTo.mockResolvedValue(undefined);
    mockTrackPlayerPlay.mockResolvedValue(undefined);
    mockTrackPlayerPause.mockResolvedValue(undefined);
    mockTrackPlayerSetRate.mockResolvedValue(undefined);
    mockTrackPlayerReset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Advance past all timers to clean up module state
    jest.advanceTimersByTime(10000);
    jest.useRealTimers();
  });

  // ===========================================================================
  // Playback control
  // ===========================================================================

  describe("playback control", () => {
    describe("play()", () => {
      it("calls TrackPlayer.play()", async () => {
        await play();

        expect(mockTrackPlayerPlay).toHaveBeenCalled();
      });

      it("emits playbackStarted event with remote: false", async () => {
        await play();

        expect(eventBusSpy).toHaveBeenCalledWith("playbackStarted", {
          remote: false,
        });
      });

      it("gets current position before playing", async () => {
        await play();

        expect(mockTrackPlayerGetProgress).toHaveBeenCalled();
      });
    });

    describe("pause()", () => {
      it("calls TrackPlayer.pause()", async () => {
        await pause();

        expect(mockTrackPlayerPause).toHaveBeenCalled();
      });

      it("emits playbackPaused event with remote: false", async () => {
        await pause();

        expect(eventBusSpy).toHaveBeenCalledWith("playbackPaused", {
          remote: false,
        });
      });

      it("applies a small backward seek to ensure progress is saved", async () => {
        // The pause function does a seekImmediateNoLog(-1, true) to ensure
        // the current position is captured correctly
        await pause();

        // Should emit seekApplied
        expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
          position: expect.any(Number),
          duration: 3600,
          userInitiated: false,
          source: SeekSource.PAUSE,
        });
      });
    });

    describe("expandPlayer()", () => {
      it("emits expandPlayer event", () => {
        expandPlayer();

        expect(eventBusSpy).toHaveBeenCalledWith("expandPlayer");
      });
    });

    describe("cancelResumePrompt()", () => {
      it("clears pendingResumePrompt", () => {
        usePlayer.setState({
          pendingResumePrompt: {
            mediaId: "media-1",
            playthroughId: "playthrough-1",
            playthroughStatus: "finished",
            position: 100,
            duration: 3600,
            statusDate: new Date(),
          },
        });

        cancelResumePrompt();

        expect(usePlayer.getState().pendingResumePrompt).toBeNull();
      });
    });
  });

  // ===========================================================================
  // Playback rate
  // ===========================================================================

  describe("playback rate", () => {
    describe("setPlaybackRate()", () => {
      it("updates playbackRate in store", async () => {
        usePlayer.setState({ playbackRate: 1.0 });

        await setPlaybackRate(DEFAULT_TEST_SESSION, 1.5);

        expect(usePlayer.getState().playbackRate).toBe(1.5);
      });

      it("calls TrackPlayer.setRate()", async () => {
        await setPlaybackRate(DEFAULT_TEST_SESSION, 2.0);

        expect(mockTrackPlayerSetRate).toHaveBeenCalledWith(2.0);
      });

      it("emits playbackRateChanged event with previous and new rate", async () => {
        usePlayer.setState({ playbackRate: 1.0 });

        await setPlaybackRate(DEFAULT_TEST_SESSION, 1.5);

        expect(eventBusSpy).toHaveBeenCalledWith("playbackRateChanged", {
          previousRate: 1.0,
          newRate: 1.5,
          position: 100, // from mockTrackPlayerGetProgress
        });
      });
    });
  });

  // ===========================================================================
  // Seeking
  // ===========================================================================

  describe("seeking", () => {
    beforeEach(() => {
      // Set up player state for seeking tests
      // Note: The seek function gets position from TrackPlayer.getProgress(),
      // but duration from store state
      usePlayer.setState({
        duration: 3600,
        playbackRate: 1.0,
      });
      // TrackPlayer mock already returns position: 100, duration: 3600
    });

    describe("seekTo()", () => {
      it("seeks to absolute position after debounce delay", async () => {
        seekTo(500, SeekSource.SCRUBBER);
        await Promise.resolve(); // Let async seek() initialize

        // Should not seek immediately
        expect(mockTrackPlayerSeekTo).not.toHaveBeenCalled();

        // Advance past the debounce window (500ms)
        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(500);
      });

      it("updates store state during seeking", async () => {
        seekTo(500, SeekSource.SCRUBBER);
        await Promise.resolve(); // Let async seek() initialize

        const state = usePlayer.getState();
        expect(state.userIsSeeking).toBe(true);
        expect(state.seekPosition).toBe(500);

        // Complete the seek to avoid state errors in afterEach
        await jest.advanceTimersByTimeAsync(5000);
      });

      it("emits seekApplied event with correct source", async () => {
        seekTo(500, SeekSource.SCRUBBER);
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
          position: 500,
          duration: 3600,
          userInitiated: true,
          source: SeekSource.SCRUBBER,
        });
      });

      it("emits seekCompleted event after long delay", async () => {
        seekTo(500, SeekSource.SCRUBBER);
        await Promise.resolve();

        // Short timer fires first
        await jest.advanceTimersByTimeAsync(500);

        // Long timer fires (5000ms total)
        await jest.advanceTimersByTimeAsync(4500);

        expect(eventBusSpy).toHaveBeenCalledWith("seekCompleted", {
          fromPosition: 100,
          toPosition: 500,
        });
      });

      it("clamps position to duration bounds", async () => {
        seekTo(5000, SeekSource.SCRUBBER); // Beyond duration
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(3600); // Clamped to duration
      });

      it("clamps position to zero", async () => {
        seekTo(-100, SeekSource.SCRUBBER); // Negative
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(0);
      });
    });

    describe("seekRelative()", () => {
      it("seeks relative to current position", async () => {
        seekRelative(30, SeekSource.BUTTON); // +30 seconds
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(130); // 100 + 30
      });

      it("seeks backward with negative amount", async () => {
        seekRelative(-30, SeekSource.BUTTON); // -30 seconds
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(70); // 100 - 30
      });

      it("accumulates multiple rapid seeks", async () => {
        seekRelative(10, SeekSource.BUTTON);
        await Promise.resolve();
        seekRelative(10, SeekSource.BUTTON);
        await Promise.resolve();
        seekRelative(10, SeekSource.BUTTON);
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        // Should only call seekTo once with accumulated value
        expect(mockTrackPlayerSeekTo).toHaveBeenCalledTimes(1);
        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(130); // 100 + 30
      });

      it("respects playback rate when calculating position", async () => {
        usePlayer.setState({ playbackRate: 1.5 });

        seekRelative(10, SeekSource.BUTTON);
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        // Position change = interval * rate = 10 * 1.5 = 15
        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(115); // 100 + 15
      });

      it("emits seekApplied event with button source", async () => {
        seekRelative(30, SeekSource.BUTTON);
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
          position: 130,
          duration: 3600,
          userInitiated: true,
          source: SeekSource.BUTTON,
        });
      });
    });

    describe("skipToEndOfChapter()", () => {
      const chapters: schema.Chapter[] = [
        { id: "ch1", title: "Chapter 1", startTime: 0, endTime: 600 },
        { id: "ch2", title: "Chapter 2", startTime: 600, endTime: 1200 },
        { id: "ch3", title: "Chapter 3", startTime: 1200, endTime: 1800 },
      ];

      it("seeks to end of current chapter", async () => {
        usePlayer.setState({
          duration: 3600,
          chapters,
          currentChapter: chapters[0],
        });

        skipToEndOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(600); // End of chapter 1
      });

      it("does nothing if no current chapter", async () => {
        usePlayer.setState({
          chapters: [],
          currentChapter: undefined,
        });

        skipToEndOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).not.toHaveBeenCalled();
      });

      it("uses duration if chapter has no endTime", async () => {
        const chaptersNoEnd: schema.Chapter[] = [
          { id: "ch1", title: "Chapter 1", startTime: 0 }, // No endTime
        ];

        usePlayer.setState({
          duration: 3600,
          chapters: chaptersNoEnd,
          currentChapter: chaptersNoEnd[0],
        });

        skipToEndOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(3600); // Uses duration
      });

      it("emits seekApplied with CHAPTER source", async () => {
        usePlayer.setState({
          duration: 3600,
          chapters,
          currentChapter: chapters[0],
        });

        skipToEndOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
          position: 600,
          duration: 3600,
          userInitiated: true,
          source: SeekSource.CHAPTER,
        });
      });
    });

    describe("skipToBeginningOfChapter()", () => {
      const chapters: schema.Chapter[] = [
        { id: "ch1", title: "Chapter 1", startTime: 0, endTime: 600 },
        { id: "ch2", title: "Chapter 2", startTime: 600, endTime: 1200 },
        { id: "ch3", title: "Chapter 3", startTime: 1200, endTime: 1800 },
      ];

      it("seeks to beginning of current chapter", async () => {
        // Mock position at 700 (in chapter 2)
        mockTrackPlayerGetProgress.mockResolvedValue({
          position: 700,
          duration: 3600,
        });

        usePlayer.setState({
          position: 700,
          duration: 3600,
          chapters,
          currentChapter: chapters[1],
          previousChapterStartTime: 0,
        });

        skipToBeginningOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(600); // Start of chapter 2
      });

      it("seeks to previous chapter if already at start", async () => {
        // Mock position exactly at chapter 2 start
        mockTrackPlayerGetProgress.mockResolvedValue({
          position: 600,
          duration: 3600,
        });

        usePlayer.setState({
          position: 600, // Exactly at start of chapter 2
          duration: 3600,
          chapters,
          currentChapter: chapters[1],
          previousChapterStartTime: 0, // Chapter 1 starts at 0
        });

        skipToBeginningOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(0); // Start of chapter 1
      });

      it("does nothing if no current chapter", async () => {
        usePlayer.setState({
          chapters: [],
          currentChapter: undefined,
        });

        skipToBeginningOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(mockTrackPlayerSeekTo).not.toHaveBeenCalled();
      });

      it("emits seekApplied with CHAPTER source", async () => {
        mockTrackPlayerGetProgress.mockResolvedValue({
          position: 700,
          duration: 3600,
        });

        usePlayer.setState({
          position: 700,
          duration: 3600,
          chapters,
          currentChapter: chapters[1],
          previousChapterStartTime: 0,
        });

        skipToBeginningOfChapter();
        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(500);

        expect(eventBusSpy).toHaveBeenCalledWith("seekApplied", {
          position: 600,
          duration: 3600,
          userInitiated: true,
          source: SeekSource.CHAPTER,
        });
      });
    });
  });

  // ===========================================================================
  // Initialization
  // ===========================================================================

  describe("initialization", () => {
    describe("initializePlayer()", () => {
      it("skips if already initialized", async () => {
        usePlayer.setState({ initialized: true });

        await initializePlayer(DEFAULT_TEST_SESSION);

        // Should not call setupPlayer since already initialized
        expect(mockTrackPlayerSetupPlayer).not.toHaveBeenCalled();
      });

      it("sets up TrackPlayer on fresh initialization", async () => {
        // No track loaded (fresh init)
        // First call: reject (triggers setupPlayer), subsequent calls: return null
        mockTrackPlayerGetTrack
          .mockRejectedValueOnce(new Error("no track"))
          .mockResolvedValue(null);

        await initializePlayer(DEFAULT_TEST_SESSION);

        expect(mockTrackPlayerSetupPlayer).toHaveBeenCalled();
        expect(mockTrackPlayerUpdateOptions).toHaveBeenCalled();
        expect(usePlayer.getState().initialized).toBe(true);
      });

      it("loads most recent in-progress playthrough on fresh init", async () => {
        const db = getDb();

        // Set up media with required book author
        const media = await createMedia(db, {
          id: "media-init-1",
          duration: "3600",
          hlsPath: "/hls/media-init-1",
          mpdPath: "/mpd/media-init-1",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create an in-progress playthrough
        const playthrough = await createPlaythrough(db, {
          mediaId: "media-init-1",
          status: "in_progress",
        });
        await createPlaythroughStateCache(db, {
          playthroughId: playthrough.id,
          currentPosition: 500,
          currentRate: 1.25,
        });

        // First call: reject (triggers setupPlayer), subsequent calls: return null
        mockTrackPlayerGetTrack
          .mockRejectedValueOnce(new Error("no track"))
          .mockResolvedValue(null);

        // Initialize device for event recording
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        await initializePlayer(DEFAULT_TEST_SESSION);

        const state = usePlayer.getState();
        expect(state.initialized).toBe(true);
        expect(state.mediaId).toBe("media-init-1");
        expect(state.position).toBe(500);
        expect(state.playbackRate).toBe(1.25);
      });

      it("sets initialized true even when no playthrough exists", async () => {
        // No track loaded and no playthrough in DB
        // First call: reject (triggers setupPlayer), subsequent calls: return null
        mockTrackPlayerGetTrack
          .mockRejectedValueOnce(new Error("no track"))
          .mockResolvedValue(null);

        await initializePlayer(DEFAULT_TEST_SESSION);

        const state = usePlayer.getState();
        expect(state.initialized).toBe(true);
        expect(state.mediaId).toBeNull();
      });

      it("recovers existing track if TrackPlayer already has media loaded", async () => {
        const db = getDb();

        // Set up media
        const media = await createMedia(db, {
          id: "media-init-2",
          duration: "3600",
          hlsPath: "/hls/media-init-2",
          mpdPath: "/mpd/media-init-2",
          chapters: [
            { id: "ch1", title: "Chapter 1", startTime: 0, endTime: 1800 },
            { id: "ch2", title: "Chapter 2", startTime: 1800, endTime: 3600 },
          ],
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create playthrough for chapters
        await createPlaythrough(db, {
          mediaId: "media-init-2",
          status: "in_progress",
        });

        // TrackPlayer already has a track loaded
        mockTrackPlayerGetTrack.mockResolvedValue({
          url: "https://example.com/stream.m3u8",
          description: "media-init-2", // mediaId stored in description
        });
        mockTrackPlayerGetProgress.mockResolvedValue({
          position: 200,
          duration: 3600,
        });
        mockTrackPlayerGetRate.mockResolvedValue(1.5);

        await initializePlayer(DEFAULT_TEST_SESSION);

        const state = usePlayer.getState();
        expect(state.initialized).toBe(true);
        expect(state.mediaId).toBe("media-init-2");
        expect(state.position).toBe(200);
        expect(state.duration).toBe(3600);
        expect(state.playbackRate).toBe(1.5);
        expect(state.streaming).toBe(true); // URL starts with http
        // Should not call setupPlayer since track already exists
        expect(mockTrackPlayerSetupPlayer).not.toHaveBeenCalled();
      });

      it("sets initializationError on failure", async () => {
        // Make getTrack throw to trigger setupPlayer
        mockTrackPlayerGetTrack.mockRejectedValueOnce(new Error("no track"));
        // Make setupPlayer fail
        mockTrackPlayerSetupPlayer.mockRejectedValue(new Error("Setup failed"));

        await initializePlayer(DEFAULT_TEST_SESSION);

        const state = usePlayer.getState();
        expect(state.initializationError).toBeInstanceOf(Error);
        expect((state.initializationError as Error).message).toBe(
          "Setup failed",
        );
        expect(state.initialized).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  describe("lifecycle", () => {
    describe("tryUnloadPlayer()", () => {
      it("pauses playback", async () => {
        await tryUnloadPlayer();

        expect(mockTrackPlayerPause).toHaveBeenCalled();
      });

      it("resets TrackPlayer", async () => {
        await tryUnloadPlayer();

        expect(mockTrackPlayerReset).toHaveBeenCalled();
      });

      it("resets player state to initial values", async () => {
        // Set some non-initial state
        usePlayer.setState({
          mediaId: "some-media",
          position: 500,
          duration: 3600,
          playbackRate: 1.5,
        });

        await tryUnloadPlayer();

        const state = usePlayer.getState();
        expect(state.mediaId).toBeNull();
        expect(state.position).toBe(0);
        expect(state.duration).toBe(0);
        expect(state.playbackRate).toBe(1);
      });

      it("does not throw on TrackPlayer errors", async () => {
        mockTrackPlayerPause.mockRejectedValue(new Error("TrackPlayer error"));

        // Should not throw
        await expect(tryUnloadPlayer()).resolves.not.toThrow();
      });
    });

    describe("forceUnloadPlayer()", () => {
      it("resets TrackPlayer without pausing first", async () => {
        await forceUnloadPlayer();

        expect(mockTrackPlayerPause).not.toHaveBeenCalled();
        expect(mockTrackPlayerReset).toHaveBeenCalled();
      });

      it("resets player state to initial values", async () => {
        usePlayer.setState({
          mediaId: "some-media",
          position: 500,
          duration: 3600,
        });

        await forceUnloadPlayer();

        const state = usePlayer.getState();
        expect(state.mediaId).toBeNull();
        expect(state.position).toBe(0);
        expect(state.duration).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Media loading
  // ===========================================================================

  describe("media loading", () => {
    describe("prepareToLoadMedia()", () => {
      it("sets loadingNewMedia to true", () => {
        expect(usePlayer.getState().loadingNewMedia).toBe(false);

        prepareToLoadMedia();

        expect(usePlayer.getState().loadingNewMedia).toBe(true);
      });
    });

    describe("loadMedia()", () => {
      it("creates new playthrough when none exists", async () => {
        const db = getDb();

        // Set up media with required book author relationship
        const media = await createMedia(db, {
          id: "media-1",
          duration: "3600",
          hlsPath: "/hls/media-1",
          mpdPath: "/mpd/media-1",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Initialize device for event recording
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        await loadMedia(DEFAULT_TEST_SESSION, "media-1");

        const state = usePlayer.getState();
        expect(state.mediaId).toBe("media-1");
        expect(state.streaming).toBe(true); // No download, so streaming
        expect(state.loadingNewMedia).toBe(false);
      });

      it("loads downloaded media from local file", async () => {
        const db = getDb();

        // Set up media with a download
        const media = await createMedia(db, {
          id: "media-downloaded",
          duration: "3600",
          hlsPath: "/hls/media-downloaded",
          mpdPath: "/mpd/media-downloaded",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create a completed download
        await createDownload(db, {
          mediaId: "media-downloaded",
          status: "ready",
          filePath: "/downloads/media-downloaded.mp4",
          thumbnails: {
            thumbhash: "abc",
            extraSmall: "/thumbs/extraSmall.webp",
            small: "/thumbs/small.webp",
            medium: "/thumbs/medium.webp",
            large: "/thumbs/large.webp",
            extraLarge: "/thumbs/extraLarge.webp",
          },
        });

        // Initialize device
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        await loadMedia(DEFAULT_TEST_SESSION, "media-downloaded");

        const state = usePlayer.getState();
        expect(state.mediaId).toBe("media-downloaded");
        expect(state.streaming).toBe(false); // Downloaded, not streaming

        // Verify TrackPlayer.add was called with local file path
        expect(mockTrackPlayerAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining("/downloads/media-downloaded.mp4"),
            description: "media-downloaded",
          }),
        );
      });

      it("resumes active in_progress playthrough", async () => {
        const db = getDb();

        // Set up media
        const media = await createMedia(db, {
          id: "media-2",
          duration: "3600",
          hlsPath: "/hls/media-2",
          mpdPath: "/mpd/media-2",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create an active playthrough with saved position
        const playthrough = await createPlaythrough(db, {
          mediaId: "media-2",
          status: "in_progress",
        });
        await createPlaythroughStateCache(db, {
          playthroughId: playthrough.id,
          currentPosition: 500,
          currentRate: 1.5,
        });

        // Initialize device
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        await loadMedia(DEFAULT_TEST_SESSION, "media-2");

        // Should seek to the saved position
        expect(mockTrackPlayerSeekTo).toHaveBeenCalledWith(500);
        expect(mockTrackPlayerSetRate).toHaveBeenCalledWith(1.5);

        const state = usePlayer.getState();
        expect(state.mediaId).toBe("media-2");
        expect(state.position).toBe(500);
        expect(state.playbackRate).toBe(1.5);
      });

      it("creates new playthrough when none exists", async () => {
        const db = getDb();

        // Set up media with no playthrough
        const media = await createMedia(db, {
          id: "media-3",
          duration: "3600",
          hlsPath: "/hls/media-3",
          mpdPath: "/mpd/media-3",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        await loadMedia(DEFAULT_TEST_SESSION, "media-3");

        const state = usePlayer.getState();
        expect(state.mediaId).toBe("media-3");
        expect(state.position).toBe(0);
        expect(state.loadingNewMedia).toBe(false);
      });
    });

    describe("checkForResumePrompt()", () => {
      it("returns false for active playthrough", async () => {
        const db = getDb();

        const media = await createMedia(db, {
          id: "media-4",
          duration: "3600",
          hlsPath: "/hls/media-4",
          mpdPath: "/mpd/media-4",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        await createPlaythrough(db, {
          mediaId: "media-4",
          status: "in_progress",
        });

        const needsPrompt = await checkForResumePrompt(
          DEFAULT_TEST_SESSION,
          "media-4",
        );

        expect(needsPrompt).toBe(false);
        expect(usePlayer.getState().pendingResumePrompt).toBeNull();
      });

      it("returns false when no playthrough exists", async () => {
        const db = getDb();

        await createMedia(db, {
          id: "media-5",
          duration: "3600",
          hlsPath: "/hls/media-5",
          mpdPath: "/mpd/media-5",
        });

        const needsPrompt = await checkForResumePrompt(
          DEFAULT_TEST_SESSION,
          "media-5",
        );

        expect(needsPrompt).toBe(false);
        expect(usePlayer.getState().pendingResumePrompt).toBeNull();
      });

      it("shows resume prompt for finished playthrough", async () => {
        const db = getDb();

        const media = await createMedia(db, {
          id: "media-6",
          duration: "3600",
          hlsPath: "/hls/media-6",
          mpdPath: "/mpd/media-6",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        const playthrough = await createPlaythrough(db, {
          mediaId: "media-6",
          status: "finished",
        });
        await createPlaythroughStateCache(db, {
          playthroughId: playthrough.id,
          currentPosition: 3500,
          currentRate: 1.0,
        });

        const needsPrompt = await checkForResumePrompt(
          DEFAULT_TEST_SESSION,
          "media-6",
        );

        expect(needsPrompt).toBe(true);
        expect(usePlayer.getState().pendingResumePrompt).toEqual({
          mediaId: "media-6",
          playthroughId: playthrough.id,
          playthroughStatus: "finished",
          position: 3500,
          duration: 3600,
          statusDate: expect.any(Date),
        });
      });

      it("shows resume prompt for abandoned playthrough", async () => {
        const db = getDb();

        const media = await createMedia(db, {
          id: "media-7",
          duration: "3600",
          hlsPath: "/hls/media-7",
          mpdPath: "/mpd/media-7",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        const playthrough = await createPlaythrough(db, {
          mediaId: "media-7",
          status: "abandoned",
        });
        await createPlaythroughStateCache(db, {
          playthroughId: playthrough.id,
          currentPosition: 1800,
          currentRate: 1.25,
        });

        const needsPrompt = await checkForResumePrompt(
          DEFAULT_TEST_SESSION,
          "media-7",
        );

        expect(needsPrompt).toBe(true);
        expect(usePlayer.getState().pendingResumePrompt).toEqual({
          mediaId: "media-7",
          playthroughId: playthrough.id,
          playthroughStatus: "abandoned",
          position: 1800,
          duration: 3600,
          statusDate: expect.any(Date),
        });
      });
    });

    describe("handleResumePlaythrough()", () => {
      it("resumes the playthrough and loads it into player", async () => {
        const db = getDb();

        // Set up media
        const media = await createMedia(db, {
          id: "media-5",
          duration: "3600",
          hlsPath: "/hls/media-5",
          mpdPath: "/mpd/media-5",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create a finished playthrough
        const playthrough = await createPlaythrough(db, {
          mediaId: "media-5",
          status: "finished",
        });
        await createPlaythroughStateCache(db, {
          playthroughId: playthrough.id,
          currentPosition: 3500,
          currentRate: 1.0,
        });

        // Set the pending prompt
        usePlayer.setState({
          pendingResumePrompt: {
            mediaId: "media-5",
            playthroughId: playthrough.id,
            playthroughStatus: "finished",
            position: 3500,
            duration: 3600,
            statusDate: new Date(),
          },
        });

        // Initialize device
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        const promise = handleResumePlaythrough(DEFAULT_TEST_SESSION);
        await jest.runAllTimersAsync();
        await promise;

        const state = usePlayer.getState();
        expect(state.pendingResumePrompt).toBeNull();
        expect(state.mediaId).toBe("media-5");
        expect(state.position).toBe(3500);
        expect(state.loadingNewMedia).toBe(false);
      });

      it("does nothing if no pending prompt", async () => {
        usePlayer.setState({ pendingResumePrompt: null });

        const promise = handleResumePlaythrough(DEFAULT_TEST_SESSION);
        await jest.runAllTimersAsync();
        await promise;

        // State should be unchanged
        expect(mockTrackPlayerAdd).not.toHaveBeenCalled();
      });
    });

    describe("handleStartFresh()", () => {
      it("creates new playthrough and loads it", async () => {
        const db = getDb();

        // Set up media
        const media = await createMedia(db, {
          id: "media-6",
          duration: "3600",
          hlsPath: "/hls/media-6",
          mpdPath: "/mpd/media-6",
        });
        await createBookAuthor(db, { bookId: media.bookId });

        // Create a finished playthrough (old one)
        const oldPlaythrough = await createPlaythrough(db, {
          mediaId: "media-6",
          status: "finished",
        });

        // Set the pending prompt
        usePlayer.setState({
          pendingResumePrompt: {
            mediaId: "media-6",
            playthroughId: oldPlaythrough.id,
            playthroughStatus: "finished",
            position: 3500,
            duration: 3600,
            statusDate: new Date(),
          },
        });

        // Initialize device
        useDevice.setState({
          initialized: true,
          deviceInfo: {
            id: "device-1",
            type: "ios",
            brand: "Apple",
            modelName: "iPhone",
            osName: "iOS",
            osVersion: "17.0",
          },
        });

        const promise = handleStartFresh(DEFAULT_TEST_SESSION);
        await jest.runAllTimersAsync();
        await promise;

        const state = usePlayer.getState();
        expect(state.pendingResumePrompt).toBeNull();
        expect(state.mediaId).toBe("media-6");
        expect(state.position).toBe(0); // Fresh start, position 0
        expect(state.loadingNewMedia).toBe(false);
      });

      it("does nothing if no pending prompt", async () => {
        usePlayer.setState({ pendingResumePrompt: null });

        const promise = handleStartFresh(DEFAULT_TEST_SESSION);
        await jest.runAllTimersAsync();
        await promise;

        // State should be unchanged
        expect(mockTrackPlayerAdd).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // Session cleanup
  // ===========================================================================

  describe("session cleanup", () => {
    it("force unloads player when session is cleared", async () => {
      // Set up a session
      useSession.setState({ session: DEFAULT_TEST_SESSION });
      usePlayer.setState({
        initialized: true,
        mediaId: "some-media",
        position: 500,
      });

      // Clear session (simulating sign out)
      useSession.setState({ session: null });

      // The subscription is async, let it process
      await jest.advanceTimersByTimeAsync(100);
      await Promise.resolve();

      expect(mockTrackPlayerReset).toHaveBeenCalled();
      expect(usePlayer.getState().mediaId).toBeNull();
    });
  });
});
