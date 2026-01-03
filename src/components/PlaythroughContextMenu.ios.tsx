// iOS version - uses SwiftUI
import { useCallback } from "react";
import { Alert, StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  resumeAndLoadPlaythrough,
} from "@/services/playback-controls";
import {
  deletePlaythrough,
  PlaythroughForMedia,
} from "@/services/playthrough-query-service";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { Colors } from "@/styles";
import { Session } from "@/types/session";

export type PlaythroughContextMenuProps = {
  session: Session;
  playthrough: PlaythroughForMedia;
};

export function PlaythroughContextMenu({
  session,
  playthrough,
}: PlaythroughContextMenuProps) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Playthrough",
      "Are you sure you want to delete this playthrough? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // FIXME: this needs to be a high level coordinator call, not a direct DB call + bump
            await deletePlaythrough(session, playthrough.id);
            bumpPlaythroughDataVersion();
          },
        },
      ],
    );
  }, [session, playthrough.id]);

  return (
    <Host style={styles.host}>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            variant="borderless"
            color={Colors.zinc[500]}
            controlSize="large"
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {playthrough.status === "in_progress" && (
            <>
              <Button
                systemImage="play.fill"
                onPress={() => {
                  continueExistingPlaythrough(session, playthrough.id);
                }}
              >
                Resume
              </Button>
            </>
          )}

          {(playthrough.status === "finished" ||
            playthrough.status === "abandoned") && (
            <Button
              systemImage="play.fill"
              onPress={() => {
                resumeAndLoadPlaythrough(session, playthrough.id);
              }}
            >
              Resume
            </Button>
          )}

          {playthrough.status === "in_progress" && (
            <>
              <Button
                systemImage="flag.fill"
                onPress={() => {
                  finishPlaythrough(session, playthrough.id);
                }}
              >
                Mark as finished
              </Button>
              <Button
                systemImage="xmark.circle"
                role="destructive"
                onPress={() => {
                  abandonPlaythrough(session, playthrough.id);
                }}
              >
                Abandon
              </Button>
            </>
          )}

          {/* Delete is always available */}
          <Button systemImage="trash" role="destructive" onPress={handleDelete}>
            Delete playthrough
          </Button>
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 44,
    height: 44,
  },
});
