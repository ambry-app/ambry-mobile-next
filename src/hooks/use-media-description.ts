import {
  getMediaDescription,
  MediaDescription,
} from "@/src/db/library/get-media-description";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";
import { useDataVersion } from "@/src/stores/dataVersion";

export function useMediaDescription(session: Session, mediaId: string) {
  const [media, setMedia] = useState<MediaDescription | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getMediaDescription(session, mediaId);
    setMedia(result);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { media };
}
