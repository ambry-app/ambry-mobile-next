import { Paths } from "expo-file-system";

/**
 * Convert a path to an absolute document directory path.
 * Handles legacy absolute paths by extracting just the filename.
 *
 * @param path - Relative filename or legacy absolute file:// path
 * @returns Absolute path in the current document directory
 *
 * @example
 * documentDirectoryFilePath("audio.mp4")
 * // "file:///data/.../files/audio.mp4"
 *
 * documentDirectoryFilePath("file:///old/path/audio.mp4")
 * // "file:///data/.../files/audio.mp4" (extracts filename only)
 */
export function documentDirectoryFilePath(path: string): string {
  if (path.startsWith("file:///")) {
    // This path was erroneously stored as an absolute path. We just want the
    // last segment (the filename) of the path, so we can generate a new
    // absolute path given the current document directory. (on iOS, the document
    // directory changes between app upgrades)
    const [lastSegment] = path.split("/").slice(-1);

    if (!lastSegment) {
      throw new Error("Invalid file path: no filename");
    }

    return Paths.document.uri + lastSegment;
  }

  return Paths.document.uri + path;
}
