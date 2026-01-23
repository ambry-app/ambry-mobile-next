// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, Host, Menu } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { Colors } from "@/styles/colors";

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
      <Menu
        label={
          <Button
            label=" "
            systemImage="ellipsis"
            modifiers={[
              buttonStyle("borderless"),
              controlSize("large"),
              tint(Colors.zinc[100]),
            ]}
          />
        }
        modifiers={[frame({ width: 44, height: 44 })]}
      >
        {status === "ready" ? (
          <Button
            label="Delete downloaded files"
            systemImage="trash"
            role="destructive"
            onPress={onDelete}
          />
        ) : (
          <Button
            label="Cancel download"
            systemImage="xmark.circle"
            onPress={onCancel}
          />
        )}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 44,
    height: 44,
  },
});
