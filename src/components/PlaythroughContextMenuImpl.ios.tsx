// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { Colors } from "@/styles/colors";

export type PlaythroughStatus =
  | "in_progress"
  | "finished"
  | "abandoned"
  | "deleted";

export type PlaythroughContextMenuImplProps = {
  status: PlaythroughStatus;
  onResume: () => void;
  onResumeFromPrevious: () => void;
  onMarkAsFinished: () => void;
  onAbandon: () => void;
  onDelete: () => void;
};

export function PlaythroughContextMenuImpl({
  status,
  onResume,
  onResumeFromPrevious,
  onMarkAsFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuImplProps) {
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
          {status === "in_progress" && (
            <Button systemImage="play.fill" onPress={onResume}>
              Resume
            </Button>
          )}

          {(status === "finished" || status === "abandoned") && (
            <Button systemImage="play.fill" onPress={onResumeFromPrevious}>
              Resume
            </Button>
          )}

          {status === "in_progress" && (
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

          {/* Delete is always available */}
          <Button systemImage="trash" role="destructive" onPress={onDelete}>
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
