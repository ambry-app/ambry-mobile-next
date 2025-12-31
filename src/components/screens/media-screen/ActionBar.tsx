import { useCallback } from "react";
import { Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import {
  IconButton,
  MediaContextMenu,
  PlayButton as PlayerPlayButton,
} from "@/components";
import { MediaHeaderInfo } from "@/db/library";
import {
  MediaPlaybackState,
  useMediaPlaybackState,
} from "@/hooks/use-media-playback-state";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import { startDownload, useDownloads } from "@/stores/downloads";
import {
  continueExistingPlaythrough,
  setPendingResumePrompt,
  startFreshPlaythrough,
} from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type ActionBarProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function ActionBar({ media, session }: ActionBarProps) {
  if (!media) return null;

  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <DownloadButton media={media} session={session} />
        <SaveButton media={media} session={session} />
        <PlayButton session={session} media={media} />
        <ShareButton media={media} session={session} />
        <MediaContextMenu media={media} session={session} />
      </View>
    </View>
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

type SaveButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function SaveButton({ media, session }: SaveButtonProps) {
  const { isOnShelf, toggleOnShelf } = useShelvedMedia(
    session,
    media.id,
    "saved",
  );

  return (
    <IconButton
      icon="bookmark"
      solid={isOnShelf}
      size={24}
      style={styles.button}
      color={Colors.zinc[100]}
      onPress={toggleOnShelf}
    />
  );
}

type PlayButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function PlayButton({ session, media }: PlayButtonProps) {
  const playbackState = useMediaPlaybackState(session, media.id);

  // Loading state - show button without onPress (effectively disabled)
  if (playbackState.type === "loading") {
    return (
      <IconButton
        icon="loading"
        size={32}
        style={styles.playButton}
        iconStyle={styles.playButtonIcon}
        color={Colors.black}
      />
    );
  }

  // If this media is currently loaded, show real-time play/pause button
  if (playbackState.type === "loaded") {
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
    <LoadMediaButton
      media={media}
      session={session}
      playbackState={playbackState}
    />
  );
}

type LoadMediaButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
  playbackState: MediaPlaybackState;
};

function LoadMediaButton({
  media,
  session,
  playbackState,
}: LoadMediaButtonProps) {
  const handlePress = useCallback(async () => {
    switch (playbackState.type) {
      case "in_progress":
        await continueExistingPlaythrough(
          session,
          playbackState.playthrough.id,
        );
        break;

      case "finished":
      case "abandoned":
        setPendingResumePrompt(playbackState);
        break;

      case "none":
        await startFreshPlaythrough(session, media.id);
        break;
    }
  }, [session, media.id, playbackState]);

  return (
    <IconButton
      icon="play"
      size={32}
      style={styles.playButton}
      iconStyle={styles.playButtonIcon}
      color={Colors.black}
      onPress={handlePress}
    />
  );
}

type ShareButtonProps = {
  media: MediaHeaderInfo;
  session: Session;
};

function ShareButton({ media, session }: ShareButtonProps) {
  const handleShare = useCallback(async () => {
    const mediaURL = `${session.url}/audiobooks/${media.id}`;
    Share.share({ message: mediaURL });
  }, [session.url, media.id]);

  return (
    <IconButton
      icon="share"
      size={24}
      style={styles.button}
      color={Colors.zinc[100]}
      onPress={handleShare}
    />
  );
}

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
