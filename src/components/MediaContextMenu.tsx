// Android version (default) - uses Jetpack Compose with overlay for custom trigger styling
import { ReactElement } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Button, ButtonProps, ContextMenu } from "@expo/ui/jetpack-compose";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { MediaHeaderInfo } from "@/db/library";
import { useMediaPlaybackState } from "@/hooks/use-media-playback-state";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import {
  cancelDownload,
  removeDownload,
  startDownload,
  useDownloads,
} from "@/stores/downloads";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  setPendingResumePrompt,
  startFreshPlaythrough,
} from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

import { IconButton } from "./IconButton";

export type MediaContextMenuProps = {
  media: MediaHeaderInfo;
  session: Session;
};

const triggerColors = {
  containerColor: "transparent",
  contentColor: "transparent",
};

const menuColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.zinc[100],
};

const destructiveColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.red[400],
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

  // Build menu items array - Android ContextMenu doesn't support fragments or null children
  const menuItems: ReactElement<ButtonProps>[] = [];

  // Play/Resume action
  if (playbackState.type === "none") {
    // Start a new playthrough
    menuItems.push(
      <Button
        key="play"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={() => {
          startFreshPlaythrough(session, media.id);
        }}
      >
        Play
      </Button>,
    );
  } else if (playbackState.type === "in_progress") {
    // Resume
    menuItems.push(
      <Button
        key="resume"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={() => {
          continueExistingPlaythrough(session, playbackState.playthrough.id);
        }}
      >
        Resume
      </Button>,
    );
  } else if (
    playbackState.type === "finished" ||
    playbackState.type === "abandoned"
  ) {
    // Open resume prompt
    menuItems.push(
      <Button
        key="resume"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={() => {
          setPendingResumePrompt(playbackState);
        }}
      >
        Play
      </Button>,
    );
  }

  // Playthrough actions
  if (playbackState.type === "in_progress" || playbackState.type === "loaded") {
    // Mark as finished or abandon
    menuItems.push(
      <Button
        key="finish"
        leadingIcon="filled.CheckCircle"
        elementColors={menuColors}
        onPress={() => {
          finishPlaythrough(session, playbackState.playthrough.id);
        }}
      >
        Mark as finished
      </Button>,
      <Button
        key="abandon"
        leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={() => {
          abandonPlaythrough(session, playbackState.playthrough.id);
        }}
      >
        Abandon
      </Button>,
    );
  }

  // Download actions
  if (!downloadStatus) {
    menuItems.push(
      <Button
        key="download"
        elementColors={menuColors}
        leadingIcon="filled.KeyboardArrowDown"
        onPress={() => {
          startDownload(session, media.id);
          router.navigate("/downloads");
        }}
      >
        Download
      </Button>,
    );
  } else if (downloadStatus === "pending") {
    menuItems.push(
      <Button
        key="cancel-download"
        leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={() => {
          cancelDownload(session, media.id);
        }}
      >
        Cancel download
      </Button>,
    );
  } else if (downloadStatus === "ready") {
    menuItems.push(
      <Button
        key="delete-download"
        leadingIcon="filled.Delete"
        elementColors={destructiveColors}
        onPress={() => {
          removeDownload(session, media.id);
        }}
      >
        Delete downloaded files
      </Button>,
    );
  } else if (downloadStatus === "error") {
    menuItems.push(
      <Button
        key="retry-download"
        elementColors={menuColors}
        onPress={() => {
          startDownload(session, media.id);
          router.navigate("/downloads");
        }}
      >
        Retry download
      </Button>,
    );
  }

  // Shelf action
  menuItems.push(
    <Button
      key="shelf"
      leadingIcon={isOnShelf ? "filled.Favorite" : "filled.FavoriteBorder"}
      elementColors={menuColors}
      onPress={toggleOnShelf}
    >
      {isOnShelf ? "Remove from saved" : "Save for later"}
    </Button>,
  );

  // Share action
  menuItems.push(
    <Button
      key="share"
      leadingIcon="filled.Share"
      elementColors={menuColors}
      onPress={() => {
        const mediaURL = `${session.url}/audiobooks/${media.id}`;
        Share.share({ message: mediaURL });
      }}
    >
      Share
    </Button>,
  );

  return (
    <View style={styles.container}>
      {/* Styled IconButton layer - visible but doesn't receive touches */}
      <View style={styles.iconLayer} pointerEvents="none">
        <IconButton
          icon="ellipsis-vertical"
          size={24}
          style={styles.button}
          color={Colors.zinc[100]}
        />
      </View>
      {/* Context menu with invisible trigger on top */}
      <ContextMenu color={Colors.zinc[800]}>
        <ContextMenu.Trigger>
          <Button elementColors={triggerColors} style={styles.trigger}>
            {" "}
          </Button>
        </ContextMenu.Trigger>
        <ContextMenu.Items>{menuItems}</ContextMenu.Items>
      </ContextMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    // Match IconButton size (icon: 24 + padding: 12*2 = 48)
    width: 48,
    height: 48,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
  trigger: {
    width: 48,
    height: 48,
  },
});
