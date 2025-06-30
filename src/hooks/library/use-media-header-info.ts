import { getMediaHeaderInfo, MediaHeaderInfo } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useMediaHeaderInfo(session: Session, mediaId: string) {
  const [media, setMedia] = useState<MediaHeaderInfo | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const media = await getMediaHeaderInfo(session, mediaId);
    setMedia(media);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { media };
}
