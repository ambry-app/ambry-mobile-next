// iOS version - uses SwiftUI
import { StyleSheet, View } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

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
    <View style={styles.container}>
      {/* Icon layer - visible but doesn't receive touches */}
      <View style={styles.iconLayer} pointerEvents="none">
        <FontAwesome6
          name="ellipsis-vertical"
          size={16}
          color={Colors.zinc[100]}
        />
      </View>
      {/* Context menu with invisible trigger on top */}
      <Host style={styles.host}>
        <ContextMenu activationMethod="singlePress">
          <ContextMenu.Trigger>
            <Button> </Button>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: 44,
    height: 44,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  host: {
    width: 44,
    height: 44,
  },
});
