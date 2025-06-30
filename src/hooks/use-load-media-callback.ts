import { syncDownUser } from "@/src/db/sync";
import {
  loadMedia,
  pause,
  prepareToLoadMedia,
  requestExpandPlayer,
} from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { useCallback } from "react";

export default function useLoadMediaCallback(
  session: Session,
  mediaId: string,
) {
  const loadMediaCallback = useCallback(async () => {
    await pause();
    requestExpandPlayer();
    prepareToLoadMedia();
    setTimeout(async () => {
      await syncDownUser(session);
      await loadMedia(session, mediaId);
    }, 400);
  }, [mediaId, session]);

  return loadMediaCallback;
}
