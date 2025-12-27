// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { Colors } from "@/styles";

export type DownloadContextMenuProps = {
  status: "pending" | "downloading" | "ready" | "error";
  onDelete: () => void;
  onCancel: () => void;
};

export function DownloadContextMenu({
  status,
  onDelete,
  onCancel,
}: DownloadContextMenuProps) {
  return (
    <Host style={styles.host}>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            variant="borderless"
            color={Colors.zinc[100]}
            controlSize="large"
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {status === "ready" ? (
            <Button systemImage="trash" role="destructive" onPress={onDelete}>
              Delete downloaded files
            </Button>
          ) : (
            <Button systemImage="xmark.circle" onPress={onCancel}>
              Cancel download
            </Button>
          )}
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
