import { ActionBarInfo, getActionBarInfo } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

export function useActionBarInfo(session: Session, mediaId: string) {
  const [media, setMedia] = useState<ActionBarInfo | null>(null);

  const load = useCallback(async () => {
    const media = await getActionBarInfo(session, mediaId);
    setMedia(media);
  }, [session, mediaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { media, reload: load };
}
