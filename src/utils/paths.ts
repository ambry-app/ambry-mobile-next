import * as FileSystem from "expo-file-system/legacy";
import { requireValue } from "./require-value";

export function documentDirectoryFilePath(path: string): string {
  if (path.startsWith("file:///")) {
    // This path was erroneously stored as an absolute path. We just want the
    // last segment (the filename) of the path, so we can generate a new
    // absolute path given the current `FileSystem.documentDirectory`.
    // (on iOS, `FileSystem.documentDirectory` changes between app upgrades)
    const [lastSegment] = path.split("/").slice(-1);

    return (
      FileSystem.documentDirectory +
      requireValue(lastSegment, "Invalid file path")
    );
  }

  return FileSystem.documentDirectory + path;
}
