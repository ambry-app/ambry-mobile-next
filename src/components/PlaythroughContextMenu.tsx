import { useCallback } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  deletePlaythrough,
  finishPlaythrough,
  PlaythroughAction,
  resumeAndLoadPlaythrough,
} from "@/services/playback-controls";
import {
  PlaythroughForMedia,
  shouldPromptForFinish,
} from "@/services/playthrough-query-service";
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
  const onResume = useCallback(async () => {
    const prompt = await shouldPromptForFinish(session);
    if (prompt.shouldPrompt) {
      const action: PlaythroughAction = {
        type: "continueExistingPlaythrough",
        playthroughId: playthrough.id,
      };

      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: prompt.playthroughId,
          continuationAction: JSON.stringify(action),
        },
      });
    } else {
      continueExistingPlaythrough(session, playthrough.id);
    }
  }, [session, playthrough.id]);

  const onResumeFromPrevious = useCallback(async () => {
    const prompt = await shouldPromptForFinish(session);
    if (prompt.shouldPrompt) {
      const action: PlaythroughAction = {
        type: "resumeAndLoadPlaythrough",
        playthroughId: playthrough.id,
      };

      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: prompt.playthroughId,
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
