import { useCallback } from "react";
import { Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { IconButton } from "@/components/IconButton";
import { MediaContextMenu } from "@/components/MediaContextMenu";
import { PlayButton as PlayerPlayButton } from "@/components/PlayButton";
import { startDownload } from "@/services/download-service";
import { MediaHeaderInfo } from "@/services/library-service";
import {
  applyPlaythroughAction,
  PlaythroughAction,
} from "@/services/playback-controls";
import {
  MediaPlaybackState,
  shouldPromptForFinish,
  useMediaPlaybackState,
} from "@/services/playthrough-query-service";
import { useShelvedMedia } from "@/services/shelf-service";
import { useDownloads } from "@/stores/downloads";
import { Colors, interactive } from "@/styles/colors";
import { Session } from "@/types/session";

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
    // if there is a currently loaded playthrough, _and_ that playthrough is at
    // >= 95% progress, then we navigate to "mark-finished-prompt", with the
    // continuationAction set appropriately based on the logic here. If there
    // isn't a loaded playthrough, or it's < 95%, we perform the action here.

    const prompt = await shouldPromptForFinish();

    const action: PlaythroughAction =
      playbackState.type === "in_progress"
        ? {
            type: "continueExistingPlaythrough",
            playthroughId: playbackState.playthrough.id,
          }
        : playbackState.type === "finished" ||
            playbackState.type === "abandoned"
          ? {
              type: "promptForResume",
              playthroughId: playbackState.playthrough.id,
            }
          : {
              type: "startFreshPlaythrough",
              mediaId: media.id,
            };

    if (prompt.shouldPrompt) {
      router.navigate({
        pathname: "/mark-finished-prompt",
        params: {
          playthroughId: prompt.playthroughId,
          continuationAction: JSON.stringify(action),
        },
      });
    } else {
      if (action.type === "promptForResume") {
        router.navigate({
          pathname: "/resume-prompt",
          params: { playthroughId: action.playthroughId },
        });
      } else {
        applyPlaythroughAction(session, action);
      }
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
    backgroundColor: interactive.selected,
    borderRadius: 999,
  },
  button: {
    backgroundColor: interactive.fillSubtle,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.zinc[800],
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
