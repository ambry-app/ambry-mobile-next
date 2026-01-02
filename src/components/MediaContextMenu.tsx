import { useCallback } from "react";
import { Share } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { MediaHeaderInfo } from "@/db/library";
import { useMediaPlaybackState } from "@/hooks/use-media-playback-state";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import {
  cancelDownload,
  removeDownload,
  startDownload,
} from "@/services/download-service";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  startFreshPlaythrough,
} from "@/services/playback-controls";
import { useDownloads } from "@/stores/downloads";
import { Session } from "@/stores/session";

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

  const onPlay = useCallback(() => {
    startFreshPlaythrough(session, media.id);
  }, [session, media.id]);

  const onResume = useCallback(() => {
    if (playbackState.type === "in_progress") {
      continueExistingPlaythrough(session, playbackState.playthrough.id);
    }
  }, [session, playbackState]);

  const onResumeFromPrompt = useCallback(() => {
    if (
      playbackState.type === "finished" ||
      playbackState.type === "abandoned"
    ) {
      router.navigate({
        pathname: "/resume-prompt",
        params: { playthroughId: playbackState.playthrough.id },
      });
    }
  }, [playbackState]);

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
