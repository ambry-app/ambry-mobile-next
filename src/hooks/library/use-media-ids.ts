import { getMediaIds, MediaIds } from "@/src/db/library/get-media-ids";
import { useDataVersion } from "@/src/stores/dataVersion";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useMediaIds(session: Session, mediaId: string) {
  const [ids, setIds] = useState<MediaIds | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const result = await getMediaIds(session, mediaId);
    setIds(result);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { ids };
}
