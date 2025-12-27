// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { Colors } from "@/styles";

export type PlaythroughStatus = "in_progress" | "finished" | "abandoned";

export type PlaythroughContextMenuProps = {
  status: PlaythroughStatus;
  onMarkFinished: () => void;
  onAbandon: () => void;
  onDelete: () => void;
};

export function PlaythroughContextMenu({
  status,
  onMarkFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuProps) {
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
          {/* Status-specific actions */}
          {status === "in_progress" && (
            <>
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
