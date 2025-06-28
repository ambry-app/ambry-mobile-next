import { ActionBarInfo, getActionBarInfo } from "@/src/db/library";
import { useDataVersion } from "@/src/stores/dataVersion";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useActionBarInfo(session: Session, mediaId: string) {
  const [media, setMedia] = useState<ActionBarInfo | null>(null);
  const libraryDataVersion = useDataVersion(
    (state) => state.libraryDataVersion,
  );

  const load = useCallback(async () => {
    const media = await getActionBarInfo(session, mediaId);
    setMedia(media);
  }, [session, mediaId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryDataVersion]);

  return { media };
}
