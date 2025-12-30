import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useMediaPlaybackState } from "@/hooks/use-media-playback-state";
import { useDataVersion } from "@/stores/data-version";
import { usePlayer } from "@/stores/player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createPlaythrough,
  createPlaythroughStateCache,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { resetStoreBeforeEach } from "@test/store-test-utils";

// Mock useIsPlaying from trackplayer-wrapper
const mockPlaying = { playing: false, bufferingDuringPlay: false };
jest.mock("@/services/trackplayer-wrapper", () => ({
  useIsPlaying: () => mockPlaying,
}));

const { getDb } = setupTestDatabase();

// Reset stores before each test
const playerInitialState = {
  initialized: false,
  initializationError: null,
  loadedPlaythrough: null,
  streaming: undefined,
  loadingNewMedia: false,
  pendingResumePrompt: null,
  pendingFinishPrompt: null,
  position: 0,
  duration: 0,
  playbackRate: 1,
  shouldRenderMini: false,
  shouldRenderExpanded: false,
  userIsSeeking: false,
  seekIsApplying: false,
  seekOriginalPosition: null,
  seekBasePosition: null,
  seekAccumulator: null,
  seekPosition: null,
  seekEffectiveDiff: null,
  seekEventFrom: null,
  seekEventTo: null,
  seekEventTimestamp: null,
  seekLastDirection: null,
  chapters: [],
  currentChapter: undefined,
  previousChapterStartTime: 0,
};

const dataVersionInitialState = {
  libraryDataVersion: 0,
  playthroughDataVersion: 0,
  shelfDataVersion: 0,
};

resetStoreBeforeEach(usePlayer, playerInitialState);
resetStoreBeforeEach(useDataVersion, dataVersionInitialState);

describe("useMediaPlaybackState", () => {
  beforeEach(() => {
    mockPlaying.playing = false;
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, "media-1"),
    );

    expect(result.current).toEqual({ type: "loading" });
  });

  it("returns none when no playthrough exists", async () => {
    const db = getDb();
    const media = await createMedia(db);

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    await waitFor(() => {
      expect(result.current).toEqual({ type: "none" });
    });
  });

  it("returns in_progress when an in-progress playthrough exists", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
      currentPosition: 100,
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    await waitFor(() => {
      expect(result.current.type).toBe("in_progress");
    });

    if (result.current.type === "in_progress") {
      expect(result.current.playthrough.id).toBe(playthrough.id);
    }
  });

  it("returns finished when a finished playthrough exists", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "finished",
      finishedAt: new Date(),
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
      currentPosition: 1000,
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    await waitFor(() => {
      expect(result.current.type).toBe("finished");
    });

    if (result.current.type === "finished") {
      expect(result.current.playthrough.id).toBe(playthrough.id);
    }
  });

  it("returns abandoned when an abandoned playthrough exists", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "abandoned",
      abandonedAt: new Date(),
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
      currentPosition: 500,
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    await waitFor(() => {
      expect(result.current.type).toBe("abandoned");
    });

    if (result.current.type === "abandoned") {
      expect(result.current.playthrough.id).toBe(playthrough.id);
    }
  });

  it("returns loaded state when media is in the player", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });

    // Set up player store to have this media loaded
    usePlayer.setState({
      loadedPlaythrough: {
        mediaId: media.id,
        playthroughId: playthrough.id,
      },
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    // Should immediately return loaded state without waiting
    expect(result.current).toEqual({ type: "loaded", isPlaying: false });
  });

  it("returns loaded with isPlaying true when playing", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });

    // Set up player store
    usePlayer.setState({
      loadedPlaythrough: {
        mediaId: media.id,
        playthroughId: playthrough.id,
      },
    });

    // Set mock to return playing
    mockPlaying.playing = true;

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    expect(result.current).toEqual({ type: "loaded", isPlaying: true });
  });

  it("prioritizes in_progress over finished/abandoned playthroughs", async () => {
    const db = getDb();
    const media = await createMedia(db);

    // Create a finished playthrough (older)
    await createPlaythrough(db, {
      id: "finished-playthrough",
      mediaId: media.id,
      status: "finished",
      finishedAt: new Date("2024-01-01"),
    });

    // Create an in-progress playthrough (newer)
    const inProgressPlaythrough = await createPlaythrough(db, {
      id: "in-progress-playthrough",
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: inProgressPlaythrough.id,
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    await waitFor(() => {
      expect(result.current.type).toBe("in_progress");
    });

    if (result.current.type === "in_progress") {
      expect(result.current.playthrough.id).toBe(inProgressPlaythrough.id);
    }
  });

  it("refreshes when playthroughDataVersion changes", async () => {
    const db = getDb();
    const media = await createMedia(db);

    const { result, rerender } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    // Initially no playthrough
    await waitFor(() => {
      expect(result.current).toEqual({ type: "none" });
    });

    // Create a playthrough
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
    });

    // Bump the data version to trigger refresh
    act(() => {
      useDataVersion.setState({ playthroughDataVersion: 1 });
    });
    rerender();

    // Should now show in_progress
    await waitFor(() => {
      expect(result.current.type).toBe("in_progress");
    });
  });

  it("switches from loaded to in_progress when media is unloaded", async () => {
    const db = getDb();
    const media = await createMedia(db);
    const playthrough = await createPlaythrough(db, {
      mediaId: media.id,
      status: "in_progress",
    });
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
    });

    // Start with media loaded
    usePlayer.setState({
      loadedPlaythrough: {
        mediaId: media.id,
        playthroughId: playthrough.id,
      },
    });

    const { result, rerender } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, media.id),
    );

    expect(result.current.type).toBe("loaded");

    // Unload the player
    act(() => {
      usePlayer.setState({ loadedPlaythrough: null });
    });
    rerender();

    // Should query DB and return in_progress
    await waitFor(() => {
      expect(result.current.type).toBe("in_progress");
    });
  });

  it("returns none for different media when player has something loaded", async () => {
    const db = getDb();
    const loadedMedia = await createMedia(db, { id: "loaded-media" });
    const otherMedia = await createMedia(db, { id: "other-media" });

    const playthrough = await createPlaythrough(db, {
      mediaId: loadedMedia.id,
      status: "in_progress",
    });

    // Load different media
    usePlayer.setState({
      loadedPlaythrough: {
        mediaId: loadedMedia.id,
        playthroughId: playthrough.id,
      },
    });

    const { result } = renderHook(() =>
      useMediaPlaybackState(DEFAULT_TEST_SESSION, otherMedia.id),
    );

    // Should query DB for otherMedia and return none
    await waitFor(() => {
      expect(result.current).toEqual({ type: "none" });
    });
  });
});
