// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, Host, Menu } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  frame,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";

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
      <Menu
        label={
          <Button
            label=" "
            systemImage="ellipsis"
            modifiers={[
              buttonStyle("plain"),
              labelStyle("iconOnly"),
              tint(Colors.zinc[100]),
              frame({ width: 48, height: 48 }),
            ]}
          />
        }
      >
        {/* Play/Resume action */}

        {playbackState.type === "none" && (
          <Button label="Play" systemImage="play.fill" onPress={onPlay} />
        )}

        {playbackState.type === "in_progress" && (
          <Button label="Resume" systemImage="play.fill" onPress={onResume} />
        )}

        {(playbackState.type === "finished" ||
          playbackState.type === "abandoned") && (
          <Button
            label="Play"
            systemImage="play.fill"
            onPress={onResumeFromPrompt}
          />
        )}

        {/* Playthrough actions */}

        {(playbackState.type === "in_progress" ||
          playbackState.type === "loaded") && (
          <>
            <Button
              label="Mark as finished"
              systemImage="flag.fill"
              onPress={onMarkAsFinished}
            />
            <Button
              label="Abandon"
              systemImage="xmark.circle"
              role="destructive"
              onPress={onAbandon}
            />
          </>
        )}

        {/* Download action*/}

        {downloadStatus === undefined && (
          <Button
            label="Download"
            systemImage="arrow.down.circle"
            onPress={onDownload}
          />
        )}

        {downloadStatus === "pending" && (
          <Button
            label="Cancel download"
            systemImage="xmark.circle"
            role="destructive"
            onPress={onCancelDownload}
          />
        )}

        {downloadStatus === "ready" && (
          <Button
            label="Delete downloaded files"
            systemImage="trash"
            role="destructive"
            onPress={onRemoveDownload}
          />
        )}

        {downloadStatus === "error" && (
          <Button
            label="Retry download"
            systemImage="arrow.down.circle"
            onPress={onDownload}
          />
        )}

        {/* Shelf action */}

        <Button
          label={isOnShelf ? "Remove from saved" : "Save for later"}
          systemImage={isOnShelf ? "bookmark.slash" : "bookmark"}
          onPress={onToggleShelf}
        />

        {/* Share action */}

        <Button
          label="Share"
          systemImage="square.and.arrow.up"
          onPress={onShare}
        />
      </Menu>
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
