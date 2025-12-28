import { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import {
  type DownloadState,
  IconButton,
  MediaContextMenu,
  PlayButton as PlayerPlayButton,
  type PlaythroughState,
} from "@/components";
import { MediaHeaderInfo } from "@/db/library";
import {
  getActivePlaythrough,
  getFinishedOrAbandonedPlaythrough,
} from "@/db/playthroughs";
import useLoadMediaCallback from "@/hooks/use-load-media-callback";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import * as Transitions from "@/services/playthrough-transitions";
import { useDataVersion } from "@/stores/data-version";
import {
  cancelDownload,
  removeDownload,
  startDownload,
  useDownloads,
} from "@/stores/downloads";
import { usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type ActionBarProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function ActionBar({ media, session }: ActionBarProps) {
  const { isOnShelf, toggleOnShelf } = useShelvedMedia(
    session,
    media.id,
    "saved",
  );

  // Check if this media is currently loaded in player
  const playerMediaId = usePlayer((state) => state.mediaId);
  const isCurrentlyLoaded = playerMediaId === media.id;

  // Subscribe to playthrough data version to refresh when playthroughs change
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );

  // Playthrough state tracking
  const [playthroughState, setPlaythroughState] =
    useState<PlaythroughState>("none");
  const [activePlaythroughId, setActivePlaythroughId] = useState<string | null>(
    null,
  );

  // Download state from store
  const downloadStatus = useDownloads(
    useShallow((state) => state.downloads[media.id]?.status),
  );
  const downloadProgress = useDownloads(
    useShallow((state) => state.downloads[media.id]?.progress),
  );

  // Map download store status to MediaContextMenu DownloadState
  const downloadState: DownloadState =
    downloadStatus === "pending"
      ? downloadProgress !== undefined
        ? "downloading"
        : "pending"
      : downloadStatus === "ready"
        ? "ready"
        : downloadStatus === "error"
          ? "error"
          : "none";

  const loadMedia = useLoadMediaCallback(session, media.id);

  // Fetch playthrough state on mount, when media changes, or when playthrough data changes
  useEffect(() => {
    async function fetchPlaythroughState() {
      const active = await getActivePlaythrough(session, media.id);
      if (active) {
        setPlaythroughState("in_progress");
        setActivePlaythroughId(active.id);
        return;
      }

      const finished = await getFinishedOrAbandonedPlaythrough(
        session,
        media.id,
      );
      if (finished?.status === "finished") {
        setPlaythroughState("finished");
        setActivePlaythroughId(null);
        return;
      }

      setPlaythroughState("none");
      setActivePlaythroughId(null);
    }

    fetchPlaythroughState();
  }, [session, media.id, playthroughVersion]);

  // Context menu handlers
  const handlePlay = useCallback(() => {
    loadMedia();
  }, [loadMedia]);

  const handleResume = useCallback(() => {
    loadMedia();
  }, [loadMedia]);

  const handleAbandon = useCallback(async () => {
    if (!activePlaythroughId) return;
    await Transitions.abandonPlaythrough(session, activePlaythroughId);
    setPlaythroughState("none");
    setActivePlaythroughId(null);
  }, [session, activePlaythroughId]);

  const handleMarkFinished = useCallback(async () => {
    if (!activePlaythroughId) return;
    await Transitions.finishPlaythrough(session, activePlaythroughId);
    setPlaythroughState("finished");
    setActivePlaythroughId(null);
  }, [session, activePlaythroughId]);

  const handleDownload = useCallback(() => {
    startDownload(session, media.id);
    router.navigate("/downloads");
  }, [session, media.id]);

  const handleDeleteDownload = useCallback(async () => {
    await removeDownload(session, media.id);
  }, [session, media.id]);

  const handleCancelDownload = useCallback(async () => {
    await cancelDownload(session, media.id);
  }, [session, media.id]);

  const handleShare = useCallback(async () => {
    const mediaURL = `${session.url}/audiobooks/${media.id}`;
    Share.share({ message: mediaURL });
  }, [session.url, media.id]);

  if (!media) return null;

  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <DownloadButton media={media} session={session} />
        <IconButton
          icon="bookmark"
          solid={isOnShelf}
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={toggleOnShelf}
        />
        <PlayButton session={session} media={media} />
        <IconButton
          icon="share"
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
          onPress={handleShare}
        />
        <MediaContextMenu
          playthroughState={playthroughState}
          downloadState={downloadState}
          isOnShelf={isOnShelf}
          isCurrentlyLoaded={isCurrentlyLoaded}
          onPlay={handlePlay}
          onResume={handleResume}
          onAbandon={handleAbandon}
          onMarkFinished={handleMarkFinished}
          onDownload={handleDownload}
          onDeleteDownload={handleDeleteDownload}
          onCancelDownload={handleCancelDownload}
          onToggleShelf={toggleOnShelf}
          onShare={handleShare}
        />
      </View>
      {/* <ExplanationText download={download} /> */}
    </View>
  );
}

type PlayButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function PlayButton({ session, media }: PlayButtonProps) {
  const playerMediaId = usePlayer((state) => state.mediaId);
  const isCurrentlyLoaded = playerMediaId === media.id;
  const loadMedia = useLoadMediaCallback(session, media.id);

  // If this media is currently loaded, show real-time play/pause button
  if (isCurrentlyLoaded) {
    return (
      <PlayerPlayButton
        size={32}
        color={Colors.black}
        style={styles.playButton}
        playIconStyle={styles.playButtonIcon}
      />
    );
  }

  // Otherwise show "load media" button
  return (
    <IconButton
      icon="play"
      size={32}
      style={styles.playButton}
      iconStyle={styles.playButtonIcon}
      color={Colors.black}
      onPress={loadMedia}
    />
  );
}

type DownloadButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function DownloadButton({ media, session }: DownloadButtonProps) {
  const status = useDownloads(
    useShallow((state) => state.downloads[media.id]?.status),
  );

  if (status === "pending") {
    return (
      <IconButton
        icon="loading"
        size={24}
        style={styles.button}
        color={Colors.zinc[100]}
        onPress={() => router.navigate("/downloads")}
      />
    );
  }

  if (status === "ready") {
    return (
      <IconButton
        icon="circle-check"
        size={24}
        style={styles.button}
        color={Colors.zinc[100]}
        onPress={() => router.navigate("/downloads")}
        solid
      />
    );
  }

  return (
    <IconButton
      icon="download"
      size={24}
      style={styles.button}
      color={Colors.zinc[100]}
      onPress={() => {
        startDownload(session, media.id);
        router.navigate("/downloads");
      }}
    />
  );
}

// type ExplanationTextProps = {
//   download: Download;
// };

// function ExplanationText({ download }: ExplanationTextProps) {
//   if (download && download.status === "ready") {
//     return (
//       <Text style={styles.explanationText}>
//         You have this audiobook downloaded, it will play from your device and
//         not require an internet connection.
//       </Text>
//     );
//   } else {
//     return (
//       <Text style={styles.explanationText}>
//         Playing this audiobook will stream it and require an internet connection
//         and may use your data plan.
//       </Text>
//     );
//   }
// }

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 16,
  },
  buttonsContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  playButton: {
    backgroundColor: Colors.zinc[100],
    borderRadius: 999,
  },
  button: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
  playButtonIcon: {
    // play button looks off center, so we need to adjust it a bit
    transform: [{ translateX: 2 }],
  },
  explanationText: {
    fontSize: 12,
    color: Colors.zinc[500],
  },
});
