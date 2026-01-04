import { useCallback } from "react";
import { router } from "expo-router";

import { FINISH_PROMPT_THRESHOLD } from "@/constants";
import { startDownload } from "@/services/download-service";
import {
  abandonPlaythrough,
  finishPlaythrough,
  unloadPlayer,
} from "@/services/playback-controls";
import { useDownloads } from "@/stores/downloads";
import {
  getPlaythroughProgress,
  type LoadedPlaythrough,
} from "@/stores/player-ui-state";
import { Session } from "@/types/session";

import { PlayerContextMenuImpl } from "./PlayerContextMenuImpl";

type AuthorOrNarrator = {
  id: string;
  name: string;
  personId: string;
  personName: string;
};

export type PlayerContextMenuProps = {
  session: Session;
  loadedPlaythrough: LoadedPlaythrough;
  bookTitle: string;
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
  onCollapse: () => void;
};

export function PlayerContextMenu({
  session,
  loadedPlaythrough,
  bookTitle,
  authors,
  narrators,
  onCollapse,
}: PlayerContextMenuProps) {
  const { mediaId, playthroughId } = loadedPlaythrough;
  const downloadStatus = useDownloads(
    (state) => state.downloads[mediaId]?.status,
  );

  const handleGoToBook = useCallback(() => {
    onCollapse();
    router.navigate({
      pathname: "/media/[id]",
      params: { id: mediaId, title: bookTitle },
    });
  }, [mediaId, bookTitle, onCollapse]);

  const handleGoToPerson = useCallback(
    (item: AuthorOrNarrator) => {
      onCollapse();
      router.navigate({
        pathname: "/person/[id]",
        params: { id: item.personId, title: item.personName },
      });
    },
    [onCollapse],
  );

  const handleUnloadPlayer = useCallback(async () => {
    const playthroughProgress = getPlaythroughProgress();

    if (
      playthroughProgress &&
      playthroughProgress.progressPercent >= FINISH_PROMPT_THRESHOLD
    ) {
      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: playthroughProgress.loadedPlaythrough.playthroughId,
          continuationAction: JSON.stringify({ type: "unloadPlayer" }),
        },
      });
    } else {
      await unloadPlayer(session);
    }
  }, [session]);

  const handleMarkFinished = useCallback(async () => {
    await finishPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

  const handleAbandon = useCallback(async () => {
    await abandonPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

  const handleDownload = useCallback(() => {
    startDownload(session, mediaId);
    router.navigate("/downloads");
  }, [session, mediaId]);

  return (
    <PlayerContextMenuImpl
      authors={authors}
      narrators={narrators}
      downloadStatus={downloadStatus}
      handleGoToBook={handleGoToBook}
      handleGoToPerson={handleGoToPerson}
      handleUnloadPlayer={handleUnloadPlayer}
      handleMarkFinished={handleMarkFinished}
      handleAbandon={handleAbandon}
      handleDownload={handleDownload}
    />
  );
}
