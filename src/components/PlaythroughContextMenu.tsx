import { useCallback } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import { FINISH_PROMPT_THRESHOLD } from "@/constants";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  deletePlaythrough,
  finishPlaythrough,
  PlaythroughAction,
  resumeAndLoadPlaythrough,
} from "@/services/playback-controls";
import { PlaythroughForMedia } from "@/services/playthrough-query-service";
import { getPlaythroughProgress } from "@/stores/player-ui-state";
import { Session } from "@/types/session";

import { PlaythroughContextMenuImpl } from "./PlaythroughContextMenuImpl";

export type PlaythroughContextMenuProps = {
  session: Session;
  playthrough: PlaythroughForMedia;
};

export function PlaythroughContextMenu({
  session,
  playthrough,
}: PlaythroughContextMenuProps) {
  const onResume = useCallback(() => {
    const playthroughProgress = getPlaythroughProgress();
    if (
      playthroughProgress &&
      playthroughProgress.progressPercent >= FINISH_PROMPT_THRESHOLD
    ) {
      const action: PlaythroughAction = {
        type: "continueExistingPlaythrough",
        playthroughId: playthrough.id,
      };

      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: playthroughProgress.loadedPlaythrough.playthroughId,
          continuationAction: JSON.stringify(action),
        },
      });
    } else {
      continueExistingPlaythrough(session, playthrough.id);
    }
  }, [session, playthrough.id]);

  const onResumeFromPrevious = useCallback(() => {
    const playthroughProgress = getPlaythroughProgress();
    if (
      playthroughProgress &&
      playthroughProgress.progressPercent >= FINISH_PROMPT_THRESHOLD
    ) {
      const action: PlaythroughAction = {
        type: "resumeAndLoadPlaythrough",
        playthroughId: playthrough.id,
      };

      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: playthroughProgress.loadedPlaythrough.playthroughId,
          continuationAction: JSON.stringify(action),
        },
      });
    } else {
      resumeAndLoadPlaythrough(session, playthrough.id);
    }
  }, [session, playthrough.id]);

  const onMarkAsFinished = useCallback(() => {
    finishPlaythrough(session, playthrough.id);
  }, [session, playthrough.id]);

  const onAbandon = useCallback(() => {
    abandonPlaythrough(session, playthrough.id);
  }, [session, playthrough.id]);

  const onDelete = useCallback(() => {
    Alert.alert(
      "Delete Playthrough",
      "Are you sure you want to delete this playthrough? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePlaythrough(session, playthrough.id),
        },
      ],
    );
  }, [session, playthrough.id]);

  return (
    <PlaythroughContextMenuImpl
      status={playthrough.status}
      onResume={onResume}
      onResumeFromPrevious={onResumeFromPrevious}
      onMarkAsFinished={onMarkAsFinished}
      onAbandon={onAbandon}
      onDelete={onDelete}
    />
  );
}
