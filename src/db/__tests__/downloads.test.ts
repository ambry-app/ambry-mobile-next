import {
  createDownload,
  deleteDownload,
  getAllDownloads,
  getDownload,
  updateDownload,
} from "@/src/db/downloads";
import { setupTestDatabase } from "@test/db-test-utils";
import { createMedia, DEFAULT_TEST_SESSION } from "@test/factories";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;

describe("downloads", () => {
  describe("getAllDownloads", () => {
    it("returns empty array when no downloads exist", async () => {
      const downloads = await getAllDownloads(session);
      expect(downloads).toEqual([]);
    });

    it("returns all downloads for the session", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db);

      await createDownload(session, media1.id, "/path/to/file1.mp4");
      await createDownload(session, media2.id, "/path/to/file2.mp4");

      const downloads = await getAllDownloads(session);
      expect(downloads).toHaveLength(2);
      expect(downloads.map((d) => d.mediaId).sort()).toEqual(
        [media1.id, media2.id].sort(),
      );
    });

    it("only returns downloads for the specified session URL", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db, { url: "http://other-server.com" });

      await createDownload(session, media1.id, "/path/to/file1.mp4");
      await createDownload(
        { ...session, url: "http://other-server.com" },
        media2.id,
        "/path/to/file2.mp4",
      );

      const downloads = await getAllDownloads(session);
      expect(downloads).toHaveLength(1);
      expect(downloads[0]!.mediaId).toBe(media1.id);
    });

    it("returns downloads ordered by downloadedAt descending", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db);
      const media3 = await createMedia(db);

      await createDownload(session, media1.id, "/path/to/file1.mp4");
      await createDownload(session, media2.id, "/path/to/file2.mp4");
      await createDownload(session, media3.id, "/path/to/file3.mp4");

      const downloads = await getAllDownloads(session);
      expect(downloads).toHaveLength(3);

      // Verify downloads are sorted by downloadedAt descending
      for (let i = 0; i < downloads.length - 1; i++) {
        expect(downloads[i]!.downloadedAt.getTime()).toBeGreaterThanOrEqual(
          downloads[i + 1]!.downloadedAt.getTime(),
        );
      }
    });
  });

  describe("getDownload", () => {
    it("returns undefined when download does not exist", async () => {
      const download = await getDownload(session, "non-existent-media-id");
      expect(download).toBeUndefined();
    });

    it("returns the download when it exists", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const download = await getDownload(session, media.id);
      expect(download).toBeDefined();
      expect(download?.mediaId).toBe(media.id);
      expect(download?.filePath).toBe("/path/to/file.mp4");
      expect(download?.status).toBe("pending");
    });

    it("does not return download from different session URL", async () => {
      const db = getDb();
      const media = await createMedia(db, { url: "http://other-server.com" });
      await createDownload(
        { ...session, url: "http://other-server.com" },
        media.id,
        "/path/to/file.mp4",
      );

      const download = await getDownload(session, media.id);
      expect(download).toBeUndefined();
    });
  });

  describe("createDownload", () => {
    it("creates a new download with pending status", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const download = await createDownload(
        session,
        media.id,
        "/path/to/file.mp4",
      );

      expect(download.mediaId).toBe(media.id);
      expect(download.filePath).toBe("/path/to/file.mp4");
      expect(download.status).toBe("pending");
      expect(download.url).toBe(session.url);
      expect(download.downloadedAt).toBeInstanceOf(Date);
    });

    it("returns the created download", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const created = await createDownload(
        session,
        media.id,
        "/path/to/file.mp4",
      );
      const fetched = await getDownload(session, media.id);

      expect(fetched).toEqual(created);
    });
  });

  describe("updateDownload", () => {
    it("updates the status to ready", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const updated = await updateDownload(session, media.id, {
        status: "ready",
      });

      expect(updated.status).toBe("ready");
    });

    it("updates the status to error", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const updated = await updateDownload(session, media.id, {
        status: "error",
      });

      expect(updated.status).toBe("error");
    });

    it("updates the file path", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const updated = await updateDownload(session, media.id, {
        filePath: "/new/path/to/file.mp4",
      });

      expect(updated.filePath).toBe("/new/path/to/file.mp4");
    });

    it("updates thumbnails", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const thumbnails = {
        extraSmall: "/path/xs.webp",
        small: "/path/sm.webp",
        medium: "/path/md.webp",
        large: "/path/lg.webp",
        extraLarge: "/path/xl.webp",
        thumbhash: "abc123",
      };

      const updated = await updateDownload(session, media.id, {
        thumbnails,
      });

      expect(updated.thumbnails).toEqual(thumbnails);
    });

    it("can set thumbnails to null", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      // First set thumbnails
      await updateDownload(session, media.id, {
        thumbnails: {
          extraSmall: "/path/xs.webp",
          small: "/path/sm.webp",
          medium: "/path/md.webp",
          large: "/path/lg.webp",
          extraLarge: "/path/xl.webp",
          thumbhash: "abc123",
        },
      });

      // Then set to null
      const updated = await updateDownload(session, media.id, {
        thumbnails: null,
      });

      expect(updated.thumbnails).toBeNull();
    });

    it("updates multiple attributes at once", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      const updated = await updateDownload(session, media.id, {
        status: "ready",
        filePath: "/new/path.mp4",
      });

      expect(updated.status).toBe("ready");
      expect(updated.filePath).toBe("/new/path.mp4");
    });
  });

  describe("deleteDownload", () => {
    it("deletes an existing download", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createDownload(session, media.id, "/path/to/file.mp4");

      await deleteDownload(session, media.id);

      const download = await getDownload(session, media.id);
      expect(download).toBeUndefined();
    });

    it("does not throw when download does not exist", async () => {
      await expect(
        deleteDownload(session, "non-existent-media-id"),
      ).resolves.not.toThrow();
    });

    it("only deletes download for the specified session URL", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db, { url: "http://other-server.com" });
      const otherSession = { ...session, url: "http://other-server.com" };

      await createDownload(session, media1.id, "/path/to/file1.mp4");
      await createDownload(otherSession, media2.id, "/path/to/file2.mp4");

      // Delete from main session
      await deleteDownload(session, media1.id);

      // Main session download should be gone
      expect(await getDownload(session, media1.id)).toBeUndefined();
      // Other session download should still exist
      expect(await getDownload(otherSession, media2.id)).toBeDefined();
    });
  });
});
