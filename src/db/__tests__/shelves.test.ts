import {
  addMediaToShelf,
  getShelvedMedia,
  isMediaOnShelf,
  removeMediaFromShelf,
  toggleMediaOnShelf,
} from "@/src/db/shelves";
import { setupTestDatabase } from "@test/db-test-utils";
import {
  createMedia,
  createShelvedMedia,
  DEFAULT_TEST_SESSION,
} from "@test/factories";

const { getDb } = setupTestDatabase();

const session = DEFAULT_TEST_SESSION;
const shelfName = "Want to Listen";

describe("shelves", () => {
  describe("getShelvedMedia", () => {
    it("returns undefined when media is not on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const result = await getShelvedMedia(session, media.id, shelfName);

      expect(result).toBeUndefined();
    });

    it("returns shelved media when it exists", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, { mediaId: media.id, shelfName });

      const result = await getShelvedMedia(session, media.id, shelfName);

      expect(result).toBeDefined();
      expect(result?.mediaId).toBe(media.id);
      expect(result?.shelfName).toBe(shelfName);
    });

    it("returns shelved media even when soft deleted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        deletedAt: new Date(),
      });

      const result = await getShelvedMedia(session, media.id, shelfName);

      expect(result).toBeDefined();
      expect(result?.deletedAt).not.toBeNull();
    });

    it("returns correct shelf for different shelf names", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName: "Favorites",
      });

      const wantToListen = await getShelvedMedia(
        session,
        media.id,
        "Want to Listen",
      );
      const favorites = await getShelvedMedia(session, media.id, "Favorites");

      expect(wantToListen).toBeUndefined();
      expect(favorites).toBeDefined();
    });
  });

  describe("isMediaOnShelf", () => {
    it("returns false when media is not on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);

      const result = await isMediaOnShelf(session, media.id, shelfName);

      expect(result).toBe(false);
    });

    it("returns true when media is on shelf and not deleted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, { mediaId: media.id, shelfName });

      const result = await isMediaOnShelf(session, media.id, shelfName);

      expect(result).toBe(true);
    });

    it("returns false when media is soft deleted from shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        deletedAt: new Date(),
      });

      const result = await isMediaOnShelf(session, media.id, shelfName);

      expect(result).toBe(false);
    });
  });

  describe("addMediaToShelf", () => {
    it("adds media to shelf when not present", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await addMediaToShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      expect(result).toBeDefined();
      expect(result?.deletedAt).toBeNull();
      expect(result?.synced).toBe(false);
    });

    it("does nothing when media is already on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const original = await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
      });

      await addMediaToShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      expect(result?.addedAt.getTime()).toBe(original.addedAt.getTime());
    });

    it("re-adds media when it was soft deleted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        deletedAt: new Date(),
        synced: true,
      });

      await addMediaToShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      expect(result?.deletedAt).toBeNull();
      expect(result?.synced).toBe(false);
    });
  });

  describe("removeMediaFromShelf", () => {
    it("does nothing when media is not on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);

      // Should not throw
      await removeMediaFromShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      expect(result).toBeUndefined();
    });

    it("does nothing when media is already deleted from shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const deletedAt = new Date("2024-01-01");
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        deletedAt,
      });

      await removeMediaFromShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      // deletedAt should remain the same
      expect(result?.deletedAt?.getTime()).toBe(deletedAt.getTime());
    });

    it("soft deletes media from shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        synced: true,
      });

      await removeMediaFromShelf(session, media.id, shelfName);

      const result = await getShelvedMedia(session, media.id, shelfName);
      expect(result?.deletedAt).not.toBeNull();
      expect(result?.synced).toBe(false);
    });
  });

  describe("toggleMediaOnShelf", () => {
    it("adds media when not on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);

      await toggleMediaOnShelf(session, media.id, shelfName);

      const result = await isMediaOnShelf(session, media.id, shelfName);
      expect(result).toBe(true);
    });

    it("removes media when on shelf", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, { mediaId: media.id, shelfName });

      await toggleMediaOnShelf(session, media.id, shelfName);

      const result = await isMediaOnShelf(session, media.id, shelfName);
      expect(result).toBe(false);
    });

    it("re-adds media when soft deleted", async () => {
      const db = getDb();
      const media = await createMedia(db);
      await createShelvedMedia(db, {
        mediaId: media.id,
        shelfName,
        deletedAt: new Date(),
      });

      await toggleMediaOnShelf(session, media.id, shelfName);

      const result = await isMediaOnShelf(session, media.id, shelfName);
      expect(result).toBe(true);
    });

    it("can toggle multiple times", async () => {
      const db = getDb();
      const media = await createMedia(db);

      // Add
      await toggleMediaOnShelf(session, media.id, shelfName);
      expect(await isMediaOnShelf(session, media.id, shelfName)).toBe(true);

      // Remove
      await toggleMediaOnShelf(session, media.id, shelfName);
      expect(await isMediaOnShelf(session, media.id, shelfName)).toBe(false);

      // Re-add
      await toggleMediaOnShelf(session, media.id, shelfName);
      expect(await isMediaOnShelf(session, media.id, shelfName)).toBe(true);
    });
  });

  describe("multi-tenant isolation", () => {
    it("shelves are isolated by session URL", async () => {
      const db = getDb();
      const media1 = await createMedia(db);
      const media2 = await createMedia(db, { url: "http://other-server.com" });
      const otherSession = { ...session, url: "http://other-server.com" };

      await addMediaToShelf(session, media1.id, shelfName);
      await addMediaToShelf(otherSession, media2.id, shelfName);

      expect(await isMediaOnShelf(session, media1.id, shelfName)).toBe(true);
      expect(await isMediaOnShelf(session, media2.id, shelfName)).toBe(false);
      expect(await isMediaOnShelf(otherSession, media1.id, shelfName)).toBe(
        false,
      );
      expect(await isMediaOnShelf(otherSession, media2.id, shelfName)).toBe(
        true,
      );
    });

    it("shelves are isolated by user email", async () => {
      const db = getDb();
      const media = await createMedia(db);
      const otherSession = { ...session, email: "other@example.com" };

      await addMediaToShelf(session, media.id, shelfName);

      expect(await isMediaOnShelf(session, media.id, shelfName)).toBe(true);
      expect(await isMediaOnShelf(otherSession, media.id, shelfName)).toBe(
        false,
      );
    });
  });
});
