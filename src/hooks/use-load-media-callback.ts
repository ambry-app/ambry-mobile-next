import { useCallback } from "react";

import { syncDownUser } from "@/db/sync";
import {
  expandPlayer,
  loadMedia,
  pause,
  prepareToLoadMedia,
} from "@/stores/player";
import { Session } from "@/stores/session";

export default function useLoadMediaCallback(
  session: Session,
  mediaId: string,
) {
  const loadMediaCallback = useCallback(async () => {
    await pause();
    prepareToLoadMedia();
    expandPlayer();
    setTimeout(async () => {
      await syncDownUser(session);
      await loadMedia(session, mediaId);
    }, 400);
  }, [mediaId, session]);

  return loadMediaCallback;
}
