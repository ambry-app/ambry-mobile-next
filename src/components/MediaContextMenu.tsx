// Android version (default) - uses Jetpack Compose with overlay for custom trigger styling
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ButtonProps, ContextMenu } from "@expo/ui/jetpack-compose";

import { Colors } from "@/styles";

import { IconButton } from "./IconButton";

export type PlaythroughState = "none" | "in_progress" | "finished";
export type DownloadState =
  | "none"
  | "pending"
  | "downloading"
  | "ready"
  | "error";

export type MediaContextMenuProps = {
  playthroughState: PlaythroughState;
  downloadState: DownloadState;
  isOnShelf: boolean;
  isCurrentlyLoaded: boolean;
  onPlay: () => void;
  onResume: () => void;
  onAbandon: () => void;
  onMarkFinished: () => void;
  onDownload: () => void;
  onDeleteDownload: () => void;
  onCancelDownload: () => void;
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

export function MediaContextMenu({
  playthroughState,
  downloadState,
  isOnShelf,
  isCurrentlyLoaded,
  onPlay,
  onResume,
  onAbandon,
  onMarkFinished,
  onDownload,
  onDeleteDownload,
  onCancelDownload,
  onToggleShelf,
  onShare,
}: MediaContextMenuProps) {
  // Build menu items array - Android ContextMenu doesn't support fragments or null children
  const menuItems: ReactElement<ButtonProps>[] = [];

  // Playthrough actions
  if (playthroughState === "none") {
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
  } else if (playthroughState === "in_progress") {
    // Only show Resume if not currently loaded in player
    if (!isCurrentlyLoaded) {
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
    }
    menuItems.push(
      <Button
        key="finish"
        leadingIcon="filled.CheckCircle"
        elementColors={menuColors}
        onPress={onMarkFinished}
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
  } else if (playthroughState === "finished") {
    menuItems.push(
      <Button
        key="play-again"
        leadingIcon="filled.Refresh"
        elementColors={menuColors}
        onPress={onPlay}
      >
        Play again
      </Button>,
    );
  }

  // Download actions
  if (downloadState === "none") {
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
  } else if (downloadState === "pending" || downloadState === "downloading") {
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
  } else if (downloadState === "ready") {
    menuItems.push(
      <Button
        key="delete-download"
        leadingIcon="filled.Delete"
        elementColors={destructiveColors}
        onPress={onDeleteDownload}
      >
        Delete downloaded files
      </Button>,
    );
  } else if (downloadState === "error") {
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
