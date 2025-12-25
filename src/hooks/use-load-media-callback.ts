import { useCallback } from "react";

import {
  checkForFinishPrompt,
  checkForResumePrompt,
  expandPlayerAndWait,
  loadMedia,
  pauseIfPlaying,
  play,
  prepareToLoadMedia,
} from "@/stores/player";
import { Session } from "@/stores/session";

export default function useLoadMediaCallback(
  session: Session,
  mediaId: string,
) {
  const loadMediaCallback = useCallback(async () => {
    await pauseIfPlaying();

    // Check if current playthrough is almost complete and should prompt to mark as finished
    const needsFinishPrompt = await checkForFinishPrompt(session, mediaId);
    if (needsFinishPrompt) {
      // Dialog will show, user will choose to mark as finished or skip
      // The dialog handlers will proceed with loading the new media
      return;
    }

    // Check if this media has a finished/abandoned playthrough that needs a prompt
    const needsResumePrompt = await checkForResumePrompt(session, mediaId);
    if (needsResumePrompt) {
      // Dialog will show, don't expand player yet
      // User will choose Resume or Start Fresh, which will expand the player
      return;
    }

    // No prompt needed, proceed with normal loading
    prepareToLoadMedia();
    await expandPlayerAndWait();
    await loadMedia(session, mediaId);
    await play();
  }, [mediaId, session]);

  return loadMediaCallback;
}
