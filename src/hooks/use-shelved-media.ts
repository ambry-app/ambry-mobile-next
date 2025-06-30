import { isMediaOnShelf, toggleMediaOnShelf } from "@/src/db/shelves";
import { Session } from "@/src/stores/session";
import { useCallback, useEffect, useState } from "react";

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
