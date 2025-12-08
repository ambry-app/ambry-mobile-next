import * as FileSystem from "expo-file-system/legacy";

import {
  cancelDownload,
  initializeDownloads,
  removeDownload,
  startDownload,
  useDownloads,
} from "@/stores/downloads";
import { loadMedia, usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createDownload as createDownloadFactory,
  createMedia,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import { mockDownloadResumable } from "@test/jest-setup";
import { resetStoreBeforeEach } from "@test/store-test-utils";

// Mock the player module to avoid pulling in react-native-track-player
jest.mock("../player", () => ({
  usePlayer: {
    getState: jest.fn(() => ({ mediaId: null })),
  },
  loadMedia: jest.fn(),
}));

const mockUsePlayer = usePlayer as jest.Mocked<typeof usePlayer>;
const mockLoadMedia = loadMedia as jest.Mock;

describe("downloads store", () => {
  const { getDb } = setupTestDatabase();

  const testSession: Session = {
    url: DEFAULT_TEST_SESSION.url,
    email: DEFAULT_TEST_SESSION.email,
    token: "test-token",
  };

  // Reset store state before each test
  resetStoreBeforeEach(useDownloads, {
    initialized: false,
    downloads: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset player mock to default state
    mockUsePlayer.getState.mockReturnValue({ mediaId: null } as ReturnType<
      typeof usePlayer.getState
    >);
  });

  describe("initializeDownloads", () => {
    it("loads downloads from database and sets initialized", async () => {
      const db = getDb();
      const media1 = await createMedia(db, { id: "media-1" });
      const media2 = await createMedia(db, { id: "media-2" });
      await createDownloadFactory(db, {
        mediaId: media1.id,
        filePath: "/path/to/media-1.mp4",
        status: "ready",
      });
      await createDownloadFactory(db, {
        mediaId: media2.id,
        filePath: "/path/to/media-2.mp4",
        status: "pending",
      });

      await initializeDownloads(testSession);

      const state = useDownloads.getState();
      expect(state.initialized).toBe(true);
      expect(Object.keys(state.downloads)).toHaveLength(2);
      expect(state.downloads["media-1"]).toMatchObject({
        mediaId: "media-1",
        filePath: "/path/to/media-1.mp4",
        status: "ready",
      });
      expect(state.downloads["media-2"]).toMatchObject({
        mediaId: "media-2",
        filePath: "/path/to/media-2.mp4",
        status: "pending",
      });
    });

    it("skips initialization if already initialized", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownloadFactory(db, { mediaId: media.id });

      // First initialization
      await initializeDownloads(testSession);
      expect(useDownloads.getState().initialized).toBe(true);

      // Add another download to DB (simulating external change)
      const media2 = await createMedia(db, { id: "media-new" });
      await createDownloadFactory(db, { mediaId: media2.id });

      // Second initialization should skip
      await initializeDownloads(testSession);

      // Should still only have the original download
      expect(Object.keys(useDownloads.getState().downloads)).toHaveLength(1);
    });

    it("handles empty downloads", async () => {
      await initializeDownloads(testSession);

      const state = useDownloads.getState();
      expect(state.initialized).toBe(true);
      expect(state.downloads).toEqual({});
    });
  });

  describe("startDownload", () => {
    it("creates download record and starts file download", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-dl" });

      // Mock successful download
      mockDownloadResumable.downloadAsync.mockResolvedValue({
        uri: "file:///test-document-directory/media-dl.mp4",
        status: 200,
      });

      await startDownload(
        testSession,
        media.id,
        "audio/media-dl/stream.mp4",
        null,
      );

      // Verify download was created in store
      const state = useDownloads.getState();
      expect(state.downloads["media-dl"]).toMatchObject({
        mediaId: "media-dl",
        filePath: "file:///test-document-directory/media-dl.mp4",
        status: "ready",
      });

      // Verify FileSystem was called correctly
      expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
        `${testSession.url}/audio/media-dl/stream.mp4`,
        "file:///test-document-directory/media-dl.mp4",
        { headers: { Authorization: `Bearer ${testSession.token}` } },
        expect.any(Function),
      );
      expect(mockDownloadResumable.downloadAsync).toHaveBeenCalled();
    });

    it("updates progress when progress callback is invoked", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-progress" });

      // Capture the progress callback
      let capturedProgressCallback:
        | ((progress: {
            totalBytesWritten: number;
            totalBytesExpectedToWrite: number;
          }) => void)
        | undefined;

      (FileSystem.createDownloadResumable as jest.Mock).mockImplementation(
        (_url, _dest, _opts, progressCallback) => {
          capturedProgressCallback = progressCallback;
          return mockDownloadResumable;
        },
      );

      mockDownloadResumable.downloadAsync.mockResolvedValue({
        uri: "file:///test-document-directory/media-progress.mp4",
        status: 200,
      });

      const downloadPromise = startDownload(
        testSession,
        media.id,
        "audio/media-progress/stream.mp4",
        null,
      );

      // Wait for download to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Invoke the progress callback
      expect(capturedProgressCallback).toBeDefined();
      capturedProgressCallback!({
        totalBytesWritten: 50,
        totalBytesExpectedToWrite: 100,
      });

      // Check progress was set
      expect(
        useDownloads.getState().downloads["media-progress"]?.progress,
      ).toBe(0.5);

      // Invoke with 100% progress (should clear progress due to iOS quirk handling)
      capturedProgressCallback!({
        totalBytesWritten: 100,
        totalBytesExpectedToWrite: 100,
      });
      expect(
        useDownloads.getState().downloads["media-progress"]?.progress,
      ).toBeUndefined();

      await downloadPromise;
    });

    it("sets status to error on download failure", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-fail" });

      // Mock failed download
      mockDownloadResumable.downloadAsync.mockRejectedValue(
        new Error("Network error"),
      );

      await startDownload(
        testSession,
        media.id,
        "audio/media-fail/stream.mp4",
        null,
      );

      const state = useDownloads.getState();
      expect(state.downloads["media-fail"]).toMatchObject({
        mediaId: "media-fail",
        status: "error",
      });
    });

    it("downloads thumbnails when provided", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-thumb" });

      mockDownloadResumable.downloadAsync.mockResolvedValue({
        uri: "file:///test-document-directory/media-thumb.mp4",
        status: 200,
      });
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
      });

      const thumbnails = {
        extraSmall: "images/xs.webp",
        small: "images/sm.webp",
        medium: "images/md.webp",
        large: "images/lg.webp",
        extraLarge: "images/xl.webp",
        thumbhash: "abc123",
      };

      await startDownload(
        testSession,
        media.id,
        "audio/media-thumb/stream.mp4",
        thumbnails,
      );

      // Verify all thumbnails were downloaded
      expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(5);
      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        `${testSession.url}/images/xs.webp`,
        "file:///test-document-directory/media-thumb-xs.webp",
        expect.any(Object),
      );

      // Verify thumbnails are stored
      const state = useDownloads.getState();
      expect(state.downloads["media-thumb"]?.thumbnails).toMatchObject({
        thumbhash: "abc123",
      });
    });

    it("reloads player if download is for currently loaded media", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-current" });

      // Set player to have this media loaded
      mockUsePlayer.getState.mockReturnValue({
        mediaId: "media-current",
      } as ReturnType<typeof usePlayer.getState>);

      mockDownloadResumable.downloadAsync.mockResolvedValue({
        uri: "file:///test-document-directory/media-current.mp4",
        status: 200,
      });

      await startDownload(
        testSession,
        media.id,
        "audio/media-current/stream.mp4",
        null,
      );

      expect(mockLoadMedia).toHaveBeenCalledWith(testSession, "media-current");
    });

    it("does not reload player if download is for different media", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-other" });

      // Player has different media loaded
      mockUsePlayer.getState.mockReturnValue({
        mediaId: "different-media",
      } as ReturnType<typeof usePlayer.getState>);

      mockDownloadResumable.downloadAsync.mockResolvedValue({
        uri: "file:///test-document-directory/media-other.mp4",
        status: 200,
      });

      await startDownload(
        testSession,
        media.id,
        "audio/media-other/stream.mp4",
        null,
      );

      expect(mockLoadMedia).not.toHaveBeenCalled();
    });
  });

  describe("cancelDownload", () => {
    it("cancels active download and removes from store", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-cancel" });

      // Create a controllable promise for the download
      let resolveDownload: () => void;
      const downloadPromise = new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });

      mockDownloadResumable.downloadAsync.mockImplementation(
        () => downloadPromise,
      );

      // Start download but don't await it
      const startPromise = startDownload(
        testSession,
        media.id,
        "audio/media-cancel/stream.mp4",
        null,
      );

      // Wait a tick for download to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify download is in store
      expect(useDownloads.getState().downloads["media-cancel"]).toBeDefined();

      // Cancel it
      await cancelDownload(testSession, "media-cancel");

      expect(mockDownloadResumable.cancelAsync).toHaveBeenCalled();
      expect(useDownloads.getState().downloads["media-cancel"]).toBeUndefined();

      // Clean up: resolve the download promise so startPromise can complete
      resolveDownload!();
      await startPromise;
    });

    it("removes download even without active resumable", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-no-resumable" });
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-no-resumable.mp4",
        status: "pending",
      });

      // Initialize to load download into store (no resumable since not actively downloading)
      await initializeDownloads(testSession);
      expect(
        useDownloads.getState().downloads["media-no-resumable"],
      ).toBeDefined();
      expect(
        useDownloads.getState().downloads["media-no-resumable"]?.resumable,
      ).toBeUndefined();

      // Cancel should work even without a resumable
      await cancelDownload(testSession, "media-no-resumable");

      expect(
        useDownloads.getState().downloads["media-no-resumable"],
      ).toBeUndefined();
    });

    it("handles error when cancelAsync throws", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-cancel-err" });

      // Create a controllable promise for the download
      let resolveDownload: () => void;
      const downloadPromise = new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });

      mockDownloadResumable.downloadAsync.mockImplementation(
        () => downloadPromise,
      );
      mockDownloadResumable.cancelAsync.mockRejectedValue(
        new Error("Cancel failed"),
      );

      // Start download but don't await it
      const startPromise = startDownload(
        testSession,
        media.id,
        "audio/media-cancel-err/stream.mp4",
        null,
      );

      // Wait a tick for download to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cancel should not throw even if cancelAsync fails
      await expect(
        cancelDownload(testSession, "media-cancel-err"),
      ).resolves.not.toThrow();

      // Download should still be removed from store
      expect(
        useDownloads.getState().downloads["media-cancel-err"],
      ).toBeUndefined();

      // Clean up
      resolveDownload!();
      await startPromise;
    });
  });

  describe("removeDownload", () => {
    it("deletes file and removes from store and database", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-remove" });
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-remove.mp4",
        status: "ready",
      });

      // Initialize to load the download into store
      await initializeDownloads(testSession);
      expect(useDownloads.getState().downloads["media-remove"]).toBeDefined();

      await removeDownload(testSession, "media-remove");

      // Verify file was deleted
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        "file:///test-document-directory/media-remove.mp4",
      );

      // Verify removed from store
      expect(useDownloads.getState().downloads["media-remove"]).toBeUndefined();

      // Verify removed from database
      const dbDownload = await db.query.downloads.findFirst({
        where: (d, { eq }) => eq(d.mediaId, "media-remove"),
      });
      expect(dbDownload).toBeUndefined();
    });

    it("deletes thumbnails if present", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-with-thumbs" });
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-with-thumbs.mp4",
        status: "ready",
        thumbnails: {
          extraSmall: "thumbs/xs.webp",
          small: "thumbs/sm.webp",
          medium: "thumbs/md.webp",
          large: "thumbs/lg.webp",
          extraLarge: "thumbs/xl.webp",
          thumbhash: "abc",
        },
      });

      await initializeDownloads(testSession);
      await removeDownload(testSession, "media-with-thumbs");

      // 1 for main file + 5 for thumbnails
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(6);
    });

    it("reloads player if removing download for currently loaded media", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-loaded" });
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-loaded.mp4",
        status: "ready",
      });

      mockUsePlayer.getState.mockReturnValue({
        mediaId: "media-loaded",
      } as ReturnType<typeof usePlayer.getState>);

      await initializeDownloads(testSession);
      await removeDownload(testSession, "media-loaded");

      expect(mockLoadMedia).toHaveBeenCalledWith(testSession, "media-loaded");
    });

    it("handles missing download gracefully", async () => {
      // Should not throw when download doesn't exist
      await expect(
        removeDownload(testSession, "nonexistent"),
      ).resolves.not.toThrow();
    });

    it("continues even if file deletion fails", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-delete-err" });
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-delete-err.mp4",
        status: "ready",
      });

      // Mock deleteAsync to fail
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(
        new Error("File not found"),
      );

      await initializeDownloads(testSession);

      // Should not throw even if delete fails
      await expect(
        removeDownload(testSession, "media-delete-err"),
      ).resolves.not.toThrow();

      // Download should still be removed from store and database
      expect(
        useDownloads.getState().downloads["media-delete-err"],
      ).toBeUndefined();
      const dbDownload = await db.query.downloads.findFirst({
        where: (d, { eq }) => eq(d.mediaId, "media-delete-err"),
      });
      expect(dbDownload).toBeUndefined();
    });
  });
});
