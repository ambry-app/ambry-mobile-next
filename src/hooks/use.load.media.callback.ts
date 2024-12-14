import { syncDownUser } from "@/src/db/sync";
import {
  loadMedia,
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
    requestExpandPlayer();
    prepareToLoadMedia();
    setTimeout(async () => {
      await syncDownUser(session, true);
      await loadMedia(session, mediaId);
    }, 400);
  }, [mediaId, session]);

  return loadMediaCallback;
}
