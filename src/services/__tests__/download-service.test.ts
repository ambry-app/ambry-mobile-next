import * as FileSystem from "expo-file-system";

import { getDownload } from "@/db/downloads";
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
  createMediaTrack,
  DEFAULT_TEST_SESSION,
} from "@test/factories";
import {
  mockFileExists,
  mockFileWritten,
  resetMockFileSystem,
} from "@test/jest-setup";

const session = DEFAULT_TEST_SESSION;

describe("download service", () => {
  const { getDb } = setupTestDatabase();

  beforeEach(() => {
    jest.clearAllMocks();
    resetDownloadsStore();
    resetMockFileSystem();
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

      await startDownload(session, media.id);

      const state = useDownloads.getState();
      expect(state.downloads["media-dl"]).toMatchObject({
        mediaId: "media-dl",
        // Stored relative: iOS moves the document directory between app
        // upgrades, so an absolute path goes stale.
        filePath: "media-dl.mp4",
        status: "ready",
      });
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

      await startDownload(session, media.id);

      // Every thumbnail size should now point at a local file, not the remote path
      const state = useDownloads.getState();
      expect(state.downloads["media-thumb"]?.thumbnails).toEqual({
        extraSmall: "file:///test-document-directory/media-thumb-xs.webp",
        small: "file:///test-document-directory/media-thumb-sm.webp",
        medium: "file:///test-document-directory/media-thumb-md.webp",
        large: "file:///test-document-directory/media-thumb-lg.webp",
        extraLarge: "file:///test-document-directory/media-thumb-xl.webp",
        thumbhash: "abc123",
      });
    });

    it("reports an error when there is nothing to download", async () => {
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
      // Saying so beats the silent no-op this used to be, which left the user
      // tapping a button that never did anything
      expect(useDownloads.getState().downloads["media-no-mp4"]).toMatchObject({
        status: "error",
      });
    });

    it("downloads every file of a direct-play recording", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-parts", mp4Path: null });
      await createMediaTrack(db, {
        mediaId: media.id,
        index: 0,
        path: "/files/book/01.m4b",
      });
      await createMediaTrack(db, {
        mediaId: media.id,
        index: 1,
        path: "/files/book/02.m4b",
      });

      await startDownload(session, media.id);

      const download = await getDownload(session, media.id);
      expect(download?.status).toBe("ready");
      // Numbered so the folder reads in playback order, with the real
      // extension so the player can pick a decoder
      expect(download?.files?.map((file) => file.path)).toEqual([
        "media-parts/000.m4b",
        "media-parts/001.m4b",
      ]);
    });

    it("keeps each downloaded file tied to its track", async () => {
      const db = getDb();
      const media = await createMedia(db, { id: "media-keyed", mp4Path: null });
      const first = await createMediaTrack(db, {
        mediaId: media.id,
        index: 0,
        path: "/files/book/01.m4b",
      });
      const second = await createMediaTrack(db, {
        mediaId: media.id,
        index: 1,
        path: "/files/book/02.opus",
      });

      await startDownload(session, media.id);

      const download = await getDownload(session, media.id);
      expect(download?.files).toEqual([
        { trackId: first.id, path: "media-keyed/000.m4b" },
        { trackId: second.id, path: "media-keyed/001.opus" },
      ]);
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

    it("discards the result when cancelled mid-transfer", async () => {
      const db = getDb();
      const media = await createMedia(db, {
        id: "media-race",
        mp4Path: "audio/media-race/stream.mp4",
      });

      // The File API can't cancel an in-flight transfer, so cancelling only
      // deletes the record and the transfer runs on. Hold it open here so we
      // can cancel underneath it, then let it settle against a missing record.
      let startTransfer: () => void;
      const transferStarted = new Promise<void>((resolve) => {
        startTransfer = resolve;
      });
      let finishTransfer: () => void;
      const transfer = new Promise<void>((resolve) => {
        finishTransfer = resolve;
      });

      jest
        .spyOn(FileSystem.File as any, "downloadFileAsync")
        .mockImplementationOnce((...args: unknown[]) => {
          const destination = args[1] as { uri: string };
          startTransfer();
          // The transfer runs to completion and writes the file, because
          // nothing was able to stop it
          return transfer.then(() => {
            mockFileWritten(destination.uri);
            return destination;
          });
        });

      const pending = startDownload(session, media.id);
      await transferStarted;

      await cancelDownload(session, media.id);
      finishTransfer!();

      // Must not reject: every caller is fire-and-forget, so anything thrown
      // here would surface as an unhandled rejection instead of an error state.
      await expect(pending).resolves.toBeUndefined();

      // The cancellation stands - the settled transfer must not resurrect it
      expect(useDownloads.getState().downloads["media-race"]).toBeUndefined();
      const dbDownload = await db.query.downloads.findFirst({
        where: (d, { eq }) => eq(d.mediaId, "media-race"),
      });
      expect(dbDownload).toBeUndefined();

      // ...and the file it finished writing must not be left orphaned on disk,
      // since with no record pointing at it there is no way to reclaim it
      expect(
        mockFileExists("file:///test-document-directory/media-race.mp4"),
      ).toBe(false);
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
