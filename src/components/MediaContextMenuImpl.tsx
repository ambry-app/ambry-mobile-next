// Android version (default) - uses Jetpack Compose with overlay for custom trigger styling
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";

import { MediaPlaybackState } from "@/services/playthrough-query-service";
import { DownloadStatus } from "@/stores/downloads";
import { Colors, interactive } from "@/styles/colors";
import { useMenuState } from "@/utils/hooks";

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
  textColor: Colors.zinc[100],
};

const destructiveColors = {
  textColor: Colors.red[400],
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
  const { expanded, open, close, selecting } = useMenuState();

  // Build menu items array - Android DropdownMenu doesn't support fragments or null children
  const menuItems: ReactElement[] = [];

  // Play/Resume action
  if (playbackState.type === "none") {
    // Start a new playthrough
    menuItems.push(
      <DropdownMenuItem
        key="play"
        elementColors={menuColors}
        onClick={selecting(onPlay)}
      >
        <DropdownMenuItem.Text>
          <Text>Play</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (playbackState.type === "in_progress") {
    // Resume
    menuItems.push(
      <DropdownMenuItem
        key="resume"
        elementColors={menuColors}
        onClick={selecting(onResume)}
      >
        <DropdownMenuItem.Text>
          <Text>Resume</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (
    playbackState.type === "finished" ||
    playbackState.type === "abandoned"
  ) {
    // Open resume prompt
    menuItems.push(
      <DropdownMenuItem
        key="resume"
        elementColors={menuColors}
        onClick={selecting(onResumeFromPrompt)}
      >
        <DropdownMenuItem.Text>
          <Text>Play</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  // Playthrough actions
  if (playbackState.type === "in_progress" || playbackState.type === "loaded") {
    // Mark as finished or abandon
    menuItems.push(
      <DropdownMenuItem
        key="finish"
        elementColors={menuColors}
        onClick={selecting(onMarkAsFinished)}
      >
        <DropdownMenuItem.Text>
          <Text>Mark as finished</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
      <DropdownMenuItem
        key="abandon"
        elementColors={destructiveColors}
        onClick={selecting(onAbandon)}
      >
        <DropdownMenuItem.Text>
          <Text>Abandon</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  // Download actions
  if (!downloadStatus) {
    menuItems.push(
      <DropdownMenuItem
        key="download"
        elementColors={menuColors}
        onClick={selecting(onDownload)}
      >
        <DropdownMenuItem.Text>
          <Text>Download</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (downloadStatus === "pending") {
    menuItems.push(
      <DropdownMenuItem
        key="cancel-download"
        elementColors={destructiveColors}
        onClick={selecting(onCancelDownload)}
      >
        <DropdownMenuItem.Text>
          <Text>Cancel download</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (downloadStatus === "ready") {
    menuItems.push(
      <DropdownMenuItem
        key="delete-download"
        elementColors={destructiveColors}
        onClick={selecting(onRemoveDownload)}
      >
        <DropdownMenuItem.Text>
          <Text>Delete downloaded files</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (downloadStatus === "error") {
    menuItems.push(
      <DropdownMenuItem
        key="retry-download"
        elementColors={menuColors}
        onClick={selecting(onDownload)}
      >
        <DropdownMenuItem.Text>
          <Text>Retry download</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  // Shelf action
  menuItems.push(
    <DropdownMenuItem
      key="shelf"
      elementColors={menuColors}
      onClick={selecting(onToggleShelf)}
    >
      <DropdownMenuItem.Text>
        <Text>{isOnShelf ? "Remove from saved" : "Save for later"}</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
  );

  // Share action
  menuItems.push(
    <DropdownMenuItem
      key="share"
      elementColors={menuColors}
      onClick={selecting(onShare)}
    >
      <DropdownMenuItem.Text>
        <Text>Share</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
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
      <Host style={styles.host}>
        <DropdownMenu
          color={interactive.fill}
          expanded={expanded}
          onDismissRequest={close}
        >
          <DropdownMenu.Trigger>
            <Button
              colors={triggerColors}
              modifiers={[fillMaxSize()]}
              onClick={open}
            >
              <Spacer />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>{menuItems}</DropdownMenu.Items>
        </DropdownMenu>
      </Host>
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
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: interactive.fillSubtle,
    borderRadius: 999,
  },
  host: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
});
