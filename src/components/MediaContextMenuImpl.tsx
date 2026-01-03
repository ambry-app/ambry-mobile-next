// Android version (default) - uses Jetpack Compose with overlay for custom trigger styling
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ButtonProps, ContextMenu } from "@expo/ui/jetpack-compose";

import { MediaPlaybackState } from "@/services/playthrough-query-service";
import { DownloadStatus } from "@/stores/downloads";
import { Colors } from "@/styles";

import { IconButton } from "./IconButton";

export type MediaContextMenuImplProps = {
  playbackState: MediaPlaybackState;
  downloadStatus: DownloadStatus | undefined;
  isOnShelf: boolean;
  onPlay: () => void;
  onResume: () => void;
  onResumeFromPrompt: () => void;
  onMarkAsFinished: () => void;
  onAbandon: () => void;
  onDownload: () => void;
  onCancelDownload: () => void;
  onRemoveDownload: () => void;
  onToggleShelf: () => void;
  onShare: () => void;
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

export function MediaContextMenuImpl({
  playbackState,
  downloadStatus,
  isOnShelf,
  onPlay,
  onResume,
  onResumeFromPrompt,
  onMarkAsFinished,
  onAbandon,
  onDownload,
  onCancelDownload,
  onRemoveDownload,
  onToggleShelf,
  onShare,
}: MediaContextMenuImplProps) {
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
        onPress={onPlay}
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
        onPress={onResume}
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
        onPress={onResumeFromPrompt}
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
        onPress={onMarkAsFinished}
      >
        Mark as finished
      </Button>,
      <Button
        key="abandon"
        leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={onAbandon}
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
        onPress={onDownload}
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
        onPress={onCancelDownload}
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
        onPress={onRemoveDownload}
      >
        Delete downloaded files
      </Button>,
    );
  } else if (downloadStatus === "error") {
    menuItems.push(
      <Button
        key="retry-download"
        elementColors={menuColors}
        onPress={onDownload}
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
      onPress={onToggleShelf}
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
      onPress={onShare}
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
