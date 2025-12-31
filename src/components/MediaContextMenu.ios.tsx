// iOS version - uses SwiftUI
import { Share, StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useShallow } from "zustand/shallow";

import { MediaHeaderInfo } from "@/db/library/get-media-header-info";
import { useMediaPlaybackState } from "@/hooks/use-media-playback-state";
import { useShelvedMedia } from "@/hooks/use-shelved-media";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  startFreshPlaythrough,
} from "@/services/playback-controls";
import {
  cancelDownload,
  removeDownload,
  startDownload,
  useDownloads,
} from "@/stores/downloads";
import { setPendingResumePrompt } from "@/stores/player-prompts";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

export type MediaContextMenuProps = {
  media: MediaHeaderInfo;
  session: Session;
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
            <Button
              systemImage="play.fill"
              onPress={() => {
                startFreshPlaythrough(session, media.id);
              }}
            >
              Play
            </Button>
          )}

          {playbackState.type === "in_progress" && (
            <Button
              systemImage="play.fill"
              onPress={() => {
                continueExistingPlaythrough(
                  session,
                  playbackState.playthrough.id,
                );
              }}
            >
              Resume
            </Button>
          )}

          {(playbackState.type === "finished" ||
            playbackState.type === "abandoned") && (
            <Button
              systemImage="play.fill"
              onPress={() => {
                setPendingResumePrompt(playbackState);
              }}
            >
              Play
            </Button>
          )}

          {/* Playthrough actions */}

          {(playbackState.type === "in_progress" ||
            playbackState.type === "loaded") && (
            <>
              <Button
                systemImage="flag.fill"
                onPress={() => {
                  finishPlaythrough(session, playbackState.playthrough.id);
                }}
              >
                Mark as finished
              </Button>
              <Button
                systemImage="xmark.circle"
                role="destructive"
                onPress={() => {
                  abandonPlaythrough(session, playbackState.playthrough.id);
                }}
              >
                Abandon
              </Button>
            </>
          )}

          {/* Download action*/}

          {downloadStatus === undefined && (
            <Button
              systemImage="arrow.down.circle"
              onPress={() => {
                startDownload(session, media.id);
                router.navigate("/downloads");
              }}
            >
              Download
            </Button>
          )}

          {downloadStatus === "pending" && (
            <Button
              systemImage="xmark.circle"
              role="destructive"
              onPress={() => {
                cancelDownload(session, media.id);
              }}
            >
              Cancel download
            </Button>
          )}

          {downloadStatus === "ready" && (
            <Button
              systemImage="trash"
              role="destructive"
              onPress={() => {
                removeDownload(session, media.id);
              }}
            >
              Delete downloaded files
            </Button>
          )}

          {downloadStatus === "error" && (
            <Button
              systemImage="arrow.down.circle"
              onPress={() => {
                startDownload(session, media.id);
                router.navigate("/downloads");
              }}
            >
              Retry download
            </Button>
          )}

          {/* Shelf action */}

          <Button
            systemImage={isOnShelf ? "bookmark.slash" : "bookmark"}
            onPress={toggleOnShelf}
          >
            {isOnShelf ? "Remove from saved" : "Save for later"}
          </Button>

          {/* Share action */}

          <Button
            systemImage="square.and.arrow.up"
            onPress={() => {
              const mediaURL = `${session.url}/audiobooks/${media.id}`;
              Share.share({ message: mediaURL });
            }}
          >
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
