/**
 * Tests for chapter-service.ts
 *
 * Uses Detroit-style testing:
 * - Real track-player-service
 * - Real seek-service (with fake timers)
 * - Mock only native modules (react-native-track-player via jest-setup.ts)
 */

import * as chapterService from "@/services/chapter-service";
import * as trackPlayerService from "@/services/track-player-service";
import {
  initialState as trackPlayerInitialState,
  SeekSource,
  useTrackPlayer,
} from "@/stores/track-player";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createBook,
  createMedia,
  createPlaythrough,
  createPlaythroughStateCache,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { resetTrackPlayerFake, trackPlayerFake } from "@test/jest-setup";
import { resetStoreBeforeEach } from "@test/store-test-utils";

// Set up fresh test DB
const { getDb } = setupTestDatabase();

// Reset store state before each test
resetStoreBeforeEach(useTrackPlayer, {
  initialized: false,
  ...trackPlayerInitialState,
});

const session = DEFAULT_TEST_SESSION;

/**
 * Helper to set up a loaded playthrough with chapters.
 */
async function setupPlaythroughWithChapters(
  options: {
    position?: number;
    chapters?: {
      id: string;
      title: string;
      startTime: number;
      endTime: number | null;
    }[];
    duration?: string;
  } = {},
) {
  const db = getDb();

  const defaultChapters = [
    { id: "ch-1", title: "Chapter 1", startTime: 0, endTime: 100 },
    { id: "ch-2", title: "Chapter 2", startTime: 100, endTime: 200 },
    { id: "ch-3", title: "Chapter 3", startTime: 200, endTime: null }, // Last chapter
  ];

  const chapters = options.chapters ?? defaultChapters;
  const position = options.position ?? 0;
  const duration = options.duration ?? "300.0";

  const book = await createBook(db, { title: "Test Book" });
  const media = await createMedia(db, {
    bookId: book.id,
    duration,
    chapters,
  });
  const playthrough = await createPlaythrough(db, {
    mediaId: media.id,
    status: "in_progress",
  });

  if (position !== 0) {
    await createPlaythroughStateCache(db, {
      playthroughId: playthrough.id,
      currentPosition: position,
      currentRate: 1.0,
    });
  }

  // Build PlaythroughWithMedia shape
  const bookWithAuthors = await db.query.books.findFirst({
    where: (b, { eq }) => eq(b.id, book.id),
    with: { bookAuthors: { with: { author: true } } },
  });

  const stateCache = await db.query.playthroughStateCache.findFirst({
    where: (c, { eq }) => eq(c.playthroughId, playthrough.id),
  });

  const playthroughWithMedia = {
    ...playthrough,
    stateCache: stateCache ?? null,
    media: {
      id: media.id,
      thumbnails: media.thumbnails,
      mpdPath: media.mpdPath,
      hlsPath: media.hlsPath,
      duration: media.duration,
      chapters: media.chapters,
      download: null,
      book: {
        id: bookWithAuthors!.id,
        title: bookWithAuthors!.title,
        bookAuthors: bookWithAuthors!.bookAuthors.map((ba) => ({
          id: ba.id,
          author: {
            id: ba.author.id,
            name: ba.author.name,
            person: { id: ba.author.personId },
          },
        })),
      },
    },
  };

  await trackPlayerService.loadPlaythroughIntoPlayer(
    session,
    playthroughWithMedia as any,
  );

  return { playthrough, media, chapters };
}

describe("chapter-service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetTrackPlayerFake();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("skipToEndOfChapter", () => {
    it("seeks to end of current chapter", async () => {
      await setupPlaythroughWithChapters({ position: 50 });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 1");

      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      // Should have sought to end of Chapter 1 (100)
      expect(trackPlayerFake.getState().position).toBe(100);
    });

    it("uses CHAPTER seek source", async () => {
      await setupPlaythroughWithChapters({ position: 50 });

      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      const lastSeek = useTrackPlayer.getState().lastSeek;
      expect(lastSeek?.source).toBe(SeekSource.CHAPTER);
    });

    it("seeks to media duration for last chapter", async () => {
      await setupPlaythroughWithChapters({
        position: 250,
        duration: "300.0",
      });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 3");

      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      // Last chapter has null endTime, so should seek to duration (300)
      expect(trackPlayerFake.getState().position).toBe(300);
    });

    it("does nothing when no chapter is loaded", async () => {
      // No playthrough loaded, no chapter
      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      // Should not have changed position from default 0
      expect(trackPlayerFake.getState().position).toBe(0);
    });
  });

  describe("skipToBeginningOfChapter", () => {
    it("seeks to beginning of current chapter when not at start", async () => {
      // Position 50 is in Chapter 1, not near the start
      await setupPlaythroughWithChapters({ position: 50 });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 1");

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // Should seek to beginning of Chapter 1 (0)
      expect(trackPlayerFake.getState().position).toBe(0);
    });

    it("skips to previous chapter when at chapter start", async () => {
      // Position 101 is just 1 second into Chapter 2 (starts at 100)
      await setupPlaythroughWithChapters({ position: 101 });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 2");

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // Should skip to beginning of previous Chapter 1 (0)
      expect(trackPlayerFake.getState().position).toBe(0);
    });

    it("skips to beginning when further into chapter than threshold", async () => {
      // Position 103 is 3 seconds into Chapter 2 (threshold is 2s)
      await setupPlaythroughWithChapters({ position: 103 });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 2");

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // Should seek to beginning of current Chapter 2 (100)
      expect(trackPlayerFake.getState().position).toBe(100);
    });

    it("stays at beginning when at first chapter start", async () => {
      // Position 1 is 1 second into Chapter 1 (first chapter, no previous)
      await setupPlaythroughWithChapters({ position: 1 });
      expect(useTrackPlayer.getState().currentChapter?.title).toBe("Chapter 1");
      expect(useTrackPlayer.getState().previousChapter).toBeNull();

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // No previous chapter, should go to 0
      expect(trackPlayerFake.getState().position).toBe(0);
    });

    it("uses CHAPTER seek source", async () => {
      await setupPlaythroughWithChapters({ position: 150 });

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      const lastSeek = useTrackPlayer.getState().lastSeek;
      expect(lastSeek?.source).toBe(SeekSource.CHAPTER);
    });

    it("does nothing when no chapter is loaded", async () => {
      // No playthrough loaded, no chapter
      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // Should not have changed position from default 0
      expect(trackPlayerFake.getState().position).toBe(0);
    });
  });

  describe("with single chapter media", () => {
    it("skipToEndOfChapter seeks to duration", async () => {
      await setupPlaythroughWithChapters({
        position: 50,
        chapters: [
          { id: "ch-1", title: "Only Chapter", startTime: 0, endTime: null },
        ],
        duration: "200.0",
      });

      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      expect(trackPlayerFake.getState().position).toBe(200);
    });

    it("skipToBeginningOfChapter seeks to 0", async () => {
      await setupPlaythroughWithChapters({
        position: 50,
        chapters: [
          { id: "ch-1", title: "Only Chapter", startTime: 0, endTime: null },
        ],
        duration: "200.0",
      });

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      expect(trackPlayerFake.getState().position).toBe(0);
    });
  });

  describe("with no chapters", () => {
    it("skipToEndOfChapter does nothing", async () => {
      await setupPlaythroughWithChapters({
        position: 50,
        chapters: [],
        duration: "200.0",
      });

      await chapterService.skipToEndOfChapter();
      await jest.runAllTimersAsync();

      // Position unchanged since no chapters
      expect(trackPlayerFake.getState().position).toBe(50);
    });

    it("skipToBeginningOfChapter does nothing", async () => {
      await setupPlaythroughWithChapters({
        position: 50,
        chapters: [],
        duration: "200.0",
      });

      await chapterService.skipToBeginningOfChapter();
      await jest.runAllTimersAsync();

      // Position unchanged since no chapters
      expect(trackPlayerFake.getState().position).toBe(50);
    });
  });
});
