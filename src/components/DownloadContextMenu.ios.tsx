// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

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
      <ContextMenu>
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
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
