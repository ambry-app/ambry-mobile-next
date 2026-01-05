import { useCallback } from "react";
import { Share } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import {
  cancelDownload,
  removeDownload,
  startDownload,
} from "@/services/download-service";
import { MediaHeaderInfo } from "@/services/library-service";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  PlaythroughAction,
  startFreshPlaythrough,
} from "@/services/playback-controls";
import {
  shouldPromptForFinish,
  useMediaPlaybackState,
} from "@/services/playthrough-query-service";
import { useShelvedMedia } from "@/services/shelf-service";
import { useDownloads } from "@/stores/downloads";
import { Session } from "@/types/session";

import { MediaContextMenuImpl } from "./MediaContextMenuImpl";

export type MediaContextMenuProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function MediaContextMenu({ media, session }: MediaContextMenuProps) {
  const playbackState = useMediaPlaybackState(session, media.id);
  const downloadStatus = useDownloads(
    useShallow((state) => state.downloads[media.id]?.status),
  );
  const { isOnShelf, toggleOnShelf } = useShelvedMedia(
    session,
    media.id,
    "saved",
  );

  const onPlay = useCallback(async () => {
    const prompt = await shouldPromptForFinish(session);

    if (prompt.shouldPrompt) {
      const action: PlaythroughAction = {
        type: "startFreshPlaythrough",
        mediaId: media.id,
      };

      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: prompt.playthroughId,
          continuationAction: JSON.stringify(action),
        },
      });
    } else {
      startFreshPlaythrough(session, media.id);
    }
  }, [session, media.id]);

  const onResume = useCallback(async () => {
    if (playbackState.type === "in_progress") {
      const prompt = await shouldPromptForFinish(session);

      if (prompt.shouldPrompt) {
        const action: PlaythroughAction = {
          type: "continueExistingPlaythrough",
          playthroughId: playbackState.playthrough.id,
        };

        router.navigate({
          pathname: "/mark-finished-prompt",
          params: {
            playthroughId: prompt.playthroughId,
            continuationAction: JSON.stringify(action),
          },
        });
      } else {
        continueExistingPlaythrough(session, playbackState.playthrough.id);
      }
    }
  }, [session, playbackState]);

  const onResumeFromPrompt = useCallback(async () => {
    if (
      playbackState.type === "finished" ||
      playbackState.type === "abandoned"
    ) {
      const shouldPrompt = await shouldPromptForFinish(session);

      if (shouldPrompt.shouldPrompt) {
        const action: PlaythroughAction = {
          type: "promptForResume",
          playthroughId: playbackState.playthrough.id,
        };

        router.navigate({
          pathname: "/mark-finished-prompt",
          params: {
            playthroughId: shouldPrompt.playthroughId,
            continuationAction: JSON.stringify(action),
          },
        });
      } else {
        router.navigate({
          pathname: "/resume-prompt",
          params: { playthroughId: playbackState.playthrough.id },
        });
      }
    }
  }, [session, playbackState]);

  const onMarkAsFinished = useCallback(() => {
    if (
      playbackState.type === "in_progress" ||
      playbackState.type === "loaded"
    ) {
      finishPlaythrough(session, playbackState.playthrough.id);
    }
  }, [session, playbackState]);

  const onAbandon = useCallback(() => {
    if (
      playbackState.type === "in_progress" ||
      playbackState.type === "loaded"
    ) {
      abandonPlaythrough(session, playbackState.playthrough.id);
    }
  }, [session, playbackState]);

  const onDownload = useCallback(() => {
    startDownload(session, media.id);
    router.navigate("/downloads");
  }, [session, media.id]);

  const onCancelDownload = useCallback(() => {
    cancelDownload(session, media.id);
  }, [session, media.id]);

  const onRemoveDownload = useCallback(() => {
    removeDownload(session, media.id);
  }, [session, media.id]);

  const onShare = useCallback(() => {
    const mediaURL = `${session.url}/audiobooks/${media.id}`;
    Share.share({ message: mediaURL });
  }, [session, media.id]);

  return (
    <MediaContextMenuImpl
      playbackState={playbackState}
      downloadStatus={downloadStatus}
      isOnShelf={isOnShelf}
      onPlay={onPlay}
      onResume={onResume}
      onResumeFromPrompt={onResumeFromPrompt}
      onMarkAsFinished={onMarkAsFinished}
      onAbandon={onAbandon}
      onDownload={onDownload}
      onCancelDownload={onCancelDownload}
      onRemoveDownload={onRemoveDownload}
      onToggleShelf={toggleOnShelf}
      onShare={onShare}
    />
  );
}
