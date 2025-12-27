// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { Colors } from "@/styles";

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
  return (
    <Host style={styles.host}>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            variant="borderedProminent"
            color={Colors.zinc[900]}
            controlSize="regular"
            modifiers={[frame({ width: 48, height: 48 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {/* Playthrough actions */}
          {playthroughState === "none" && (
            <Button systemImage="play.fill" onPress={onPlay}>
              Play
            </Button>
          )}
          {playthroughState === "in_progress" && (
            <>
              {!isCurrentlyLoaded && (
                <Button systemImage="play.fill" onPress={onResume}>
                  Resume
                </Button>
              )}
              <Button systemImage="flag.fill" onPress={onMarkFinished}>
                Mark as finished
              </Button>
              <Button
                systemImage="xmark.circle"
                role="destructive"
                onPress={onAbandon}
              >
                Abandon
              </Button>
            </>
          )}
          {playthroughState === "finished" && (
            <Button systemImage="arrow.counterclockwise" onPress={onPlay}>
              Play again
            </Button>
          )}

          {/* Download actions */}
          {downloadState === "none" && (
            <Button systemImage="arrow.down.circle" onPress={onDownload}>
              Download
            </Button>
          )}
          {(downloadState === "pending" || downloadState === "downloading") && (
            <Button
              systemImage="xmark.circle"
              role="destructive"
              onPress={onCancelDownload}
            >
              Cancel download
            </Button>
          )}
          {downloadState === "ready" && (
            <Button
              systemImage="trash"
              role="destructive"
              onPress={onDeleteDownload}
            >
              Delete downloaded files
            </Button>
          )}
          {downloadState === "error" && (
            <Button systemImage="arrow.down.circle" onPress={onDownload}>
              Retry download
            </Button>
          )}

          {/* Shelf action */}
          <Button
            systemImage={isOnShelf ? "bookmark.slash" : "bookmark"}
            onPress={onToggleShelf}
          >
            {isOnShelf ? "Remove from saved" : "Save for later"}
          </Button>

          {/* Share action */}
          <Button systemImage="square.and.arrow.up" onPress={onShare}>
            Share
          </Button>
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 48,
    height: 48,
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
});
