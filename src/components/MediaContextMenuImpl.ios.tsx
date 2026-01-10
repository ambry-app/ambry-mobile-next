// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { MediaPlaybackState } from "@/services/playthrough-query-service";
import { DownloadStatus } from "@/stores/downloads";
import { Colors } from "@/styles/colors";

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
          {/* Play/Resume action */}

          {playbackState.type === "none" && (
            <Button systemImage="play.fill" onPress={onPlay}>
              Play
            </Button>
          )}

          {playbackState.type === "in_progress" && (
            <Button systemImage="play.fill" onPress={onResume}>
              Resume
            </Button>
          )}

          {(playbackState.type === "finished" ||
            playbackState.type === "abandoned") && (
            <Button systemImage="play.fill" onPress={onResumeFromPrompt}>
              Play
            </Button>
          )}

          {/* Playthrough actions */}

          {(playbackState.type === "in_progress" ||
            playbackState.type === "loaded") && (
            <>
              <Button systemImage="flag.fill" onPress={onMarkAsFinished}>
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

          {/* Download action*/}

          {downloadStatus === undefined && (
            <Button systemImage="arrow.down.circle" onPress={onDownload}>
              Download
            </Button>
          )}

          {downloadStatus === "pending" && (
            <Button
              systemImage="xmark.circle"
              role="destructive"
              onPress={onCancelDownload}
            >
              Cancel download
            </Button>
          )}

          {downloadStatus === "ready" && (
            <Button
              systemImage="trash"
              role="destructive"
              onPress={onRemoveDownload}
            >
              Delete downloaded files
            </Button>
          )}

          {downloadStatus === "error" && (
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
