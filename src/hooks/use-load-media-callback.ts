import { useCallback } from "react";

import {
  checkForResumePrompt,
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

    // Check if this media has a finished/abandoned playthrough that needs a prompt
    const needsPrompt = await checkForResumePrompt(session, mediaId);
    if (needsPrompt) {
      // Dialog will show, don't expand player yet
      // User will choose Resume or Start Fresh, which will expand the player
      return;
    }

    // No prompt needed, proceed with normal loading
    prepareToLoadMedia();
    expandPlayer();
    setTimeout(async () => {
      await loadMedia(session, mediaId);
    }, 400);
  }, [mediaId, session]);

  return loadMediaCallback;
}
