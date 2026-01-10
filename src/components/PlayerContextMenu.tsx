import { useCallback } from "react";
import { router } from "expo-router";

import { startDownload } from "@/services/download-service";
import {
  abandonPlaythrough,
  finishPlaythrough,
  unloadPlayer,
} from "@/services/playback-controls";
import { shouldPromptForFinish } from "@/services/playthrough-query-service";
import { useDownloads } from "@/stores/downloads";
import { LoadedPlaythrough } from "@/stores/track-player";
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
  playthrough: LoadedPlaythrough;
  bookTitle: string;
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
  onCollapse: () => void;
};

export function PlayerContextMenu({
  session,
  playthrough,
  bookTitle,
  authors,
  narrators,
  onCollapse,
}: PlayerContextMenuProps) {
  const { mediaId, id: playthroughId } = playthrough;
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
    const prompt = await shouldPromptForFinish(session);

    if (prompt.shouldPrompt) {
      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: prompt.playthroughId,
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
