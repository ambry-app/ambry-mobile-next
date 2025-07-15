import { getDownloadedMedia } from "@/src/db/library";
import { useDownloads } from "@/src/stores/downloads";
import { Session } from "@/src/stores/session";
import { useShallow } from "zustand/shallow";
import { useLibraryData } from "./use-library-data";

export function useDownloadedMedia(session: Session) {
  const mediaIds = useDownloads(
    useShallow((state) => Object.keys(state.downloads)),
  );

  // NOTE: if the user has downloaded many media, this could be a large query.
  const media = useLibraryData(
    () => getDownloadedMedia(session, mediaIds),
    [mediaIds],
  );

  return media;
}
