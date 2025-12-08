import { documentDirectoryFilePath } from "@/utils/paths";

// Uses global expo-file-system mock from jest-setup.ts

describe("documentDirectoryFilePath", () => {
  const docDir = "file:///test-document-directory/";

  describe("relative paths", () => {
    it("prepends document directory to simple filename", () => {
      expect(documentDirectoryFilePath("audio.mp4")).toBe(`${docDir}audio.mp4`);
    });

    it("prepends document directory to filename with subdirectory", () => {
      expect(documentDirectoryFilePath("downloads/audio.mp4")).toBe(
        `${docDir}downloads/audio.mp4`,
      );
    });
  });

  describe("absolute paths (legacy fix)", () => {
    it("extracts filename from absolute file:// path", () => {
      // This handles legacy paths that were stored incorrectly
      const absolutePath = "file:///old/path/that/changed/audio.mp4";
      expect(documentDirectoryFilePath(absolutePath)).toBe(
        `${docDir}audio.mp4`,
      );
    });

    it("extracts filename from different absolute path", () => {
      const absolutePath =
        "file:///var/mobile/Containers/Data/Application/ABC123/Documents/book.mp4";
      expect(documentDirectoryFilePath(absolutePath)).toBe(`${docDir}book.mp4`);
    });
  });

  describe("edge cases", () => {
    it("handles empty path", () => {
      expect(documentDirectoryFilePath("")).toBe(docDir);
    });

    it("handles path with special characters", () => {
      expect(documentDirectoryFilePath("my file (1).mp4")).toBe(
        `${docDir}my file (1).mp4`,
      );
    });

    it("throws for absolute path with no filename", () => {
      expect(() => documentDirectoryFilePath("file:///some/path/")).toThrow(
        "Invalid file path: no filename",
      );
    });
  });
});
