import { useCallback, useEffect, useState } from "react";

import { isMediaOnShelf, toggleMediaOnShelf } from "@/db/shelves";
import { Session } from "@/stores/session";

export function useShelvedMedia(
  session: Session,
  mediaId: string,
  shelfName: string,
) {
  const [isOnShelf, setIsOnShelf] = useState<boolean>(false);

  const load = useCallback(async () => {
    setIsOnShelf(await isMediaOnShelf(session, mediaId, shelfName));
  }, [session, mediaId, shelfName]);

  const toggleOnShelf = useCallback(async () => {
    await toggleMediaOnShelf(session, mediaId, shelfName);
    await load();
  }, [session, mediaId, shelfName, load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnShelf, toggleOnShelf };
}
