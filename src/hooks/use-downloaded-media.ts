import { getDownloadedMedia } from "@/src/db/library";
import { useDownloads } from "@/src/stores/downloads";
import { Session } from "@/src/stores/session";
import { useShallow } from "zustand/shallow";
import { useLibraryData } from "./use-library-data";

export function useDownloadedMedia(session: Session) {
  const mediaIds = useDownloads(
    useShallow((state) => Object.keys(state.downloads)),
  );

  const media = useLibraryData(
    () => getDownloadedMedia(session, mediaIds),
    [mediaIds],
  );

  return media;
}
