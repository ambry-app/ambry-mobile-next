import * as FileSystem from "expo-file-system";

import {
  cancelDownload,
  initializeDownloads,
  removeDownload,
  startDownload,
} from "@/services/download-service";
import {
  resetForTesting as resetDownloadsStore,
  useDownloads,
} from "@/stores/downloads";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createDownload as createDownloadFactory,
  createMedia,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const session = DEFAULT_TEST_SESSION;

describe("download service", () => {
  const { getDb } = setupTestDatabase();

  beforeEach(() => {
    jest.clearAllMocks();
    resetDownloadsStore();
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

      await initializeDownloads(session);

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
      await initializeDownloads(session);
      expect(useDownloads.getState().initialized).toBe(true);

      // Add another download to DB (simulating external change)
      const media2 = await createMedia(db, { id: "media-new" });
      await createDownloadFactory(db, { mediaId: media2.id });

      // Second initialization should skip
      await initializeDownloads(session);

      // Should still only have the original download
      expect(Object.keys(useDownloads.getState().downloads)).toHaveLength(1);
    });

    it("handles empty downloads", async () => {
      await initializeDownloads(session);

      const state = useDownloads.getState();
      expect(state.initialized).toBe(true);
      expect(state.downloads).toEqual({});
    });
  });

  describe("startDownload", () => {
    it("creates download record and starts file download", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        id: "media-dl",
        mp4Path: "audio/media-dl/stream.mp4",
      });

      const downloadSpy = jest.spyOn(
        FileSystem.File as any,
        "downloadFileAsync",
      );

      await startDownload(session, media.id);

      // Verify download was created in store
      const state = useDownloads.getState();
      expect(state.downloads["media-dl"]).toMatchObject({
        mediaId: "media-dl",
        filePath: "file:///test-document-directory/media-dl.mp4",
        status: "ready",
      });

      // Verify File.downloadFileAsync was called
      expect(downloadSpy).toHaveBeenCalledWith(
        `${session.url}/audio/media-dl/stream.mp4`,
        expect.objectContaining({
          uri: "file:///test-document-directory/media-dl.mp4",
        }),
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
    });

    it("sets status to error on download failure", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        id: "media-fail",
        mp4Path: "audio/media-fail/stream.mp4",
      });

      jest
        .spyOn(FileSystem.File as any, "downloadFileAsync")
        .mockRejectedValueOnce(new Error("Network error"));

      await startDownload(session, media.id);

      const state = useDownloads.getState();
      expect(state.downloads["media-fail"]).toMatchObject({
        mediaId: "media-fail",
        status: "error",
      });
    });

    it("downloads thumbnails when provided", async () => {
      const db = getDb();
      const thumbnails = {
        extraSmall: "images/xs.webp",
        small: "images/sm.webp",
        medium: "images/md.webp",
        large: "images/lg.webp",
        extraLarge: "images/xl.webp",
        thumbhash: "abc123",
      };
      const media = await createMedia(db, {
        id: "media-thumb",
        mp4Path: "audio/media-thumb/stream.mp4",
        thumbnails,
      });

      const downloadSpy = jest.spyOn(
        FileSystem.File as any,
        "downloadFileAsync",
      );

      await startDownload(session, media.id);

      // Verify all thumbnails were downloaded (5 thumbnails + 1 main file)
      expect(downloadSpy).toHaveBeenCalledTimes(6);
      expect(downloadSpy).toHaveBeenCalledWith(
        `${session.url}/images/xs.webp`,
        expect.objectContaining({
          uri: "file:///test-document-directory/media-thumb-xs.webp",
        }),
        expect.any(Object),
      );

      // Verify thumbnails are stored
      const state = useDownloads.getState();
      expect(state.downloads["media-thumb"]?.thumbnails).toMatchObject({
        thumbhash: "abc123",
      });
    });

    it("does nothing if media has no mp4Path", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        id: "media-no-mp4",
        mp4Path: null,
      });

      const downloadSpy = jest.spyOn(
        FileSystem.File as any,
        "downloadFileAsync",
      );

      await startDownload(session, media.id);

      expect(downloadSpy).not.toHaveBeenCalled();
      expect(useDownloads.getState().downloads["media-no-mp4"]).toBeUndefined();
    });
  });

  describe("cancelDownload", () => {
    it("removes download from store", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        id: "media-cancel",
        mp4Path: "audio/media-cancel/stream.mp4",
      });

      // Start download (simulated)
      await createDownloadFactory(db, {
        mediaId: media.id,
        filePath: "media-cancel.mp4",
        status: "pending",
      });
      await initializeDownloads(session);

      // Cancel it
      await cancelDownload(session, "media-cancel");

      expect(useDownloads.getState().downloads["media-cancel"]).toBeUndefined();
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
      await initializeDownloads(session);
      expect(useDownloads.getState().downloads["media-remove"]).toBeDefined();

      await removeDownload(session, "media-remove");

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

      await initializeDownloads(session);
      await removeDownload(session, "media-with-thumbs");

      expect(
        useDownloads.getState().downloads["media-with-thumbs"],
      ).toBeUndefined();
    });

    it("handles missing download gracefully", async () => {
      // Should not throw when download doesn't exist
      await expect(
        removeDownload(session, "nonexistent"),
      ).resolves.not.toThrow();
    });
  });
});
