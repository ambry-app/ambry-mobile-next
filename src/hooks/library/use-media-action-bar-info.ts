import { MediaActionBarInfo, getMediaActionBarInfo } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useMediaActionBarInfo(session: Session, mediaId: string) {
  const [media, setMedia] = useState<MediaActionBarInfo | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const media = await getMediaActionBarInfo(session, mediaId);
    setMedia(media);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { media };
}
