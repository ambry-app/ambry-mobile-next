import { getSearchedMedia, MediaSearchResult } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/data-version";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useMediaSearch(session: Session, searchQuery: string) {
  const [media, setMedia] = useState<MediaSearchResult | undefined>(undefined);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const media = await getSearchedMedia(session, 64, searchQuery);
    setMedia(media);
  }, [session, searchQuery]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion, searchQuery]);

  return { media };
}
