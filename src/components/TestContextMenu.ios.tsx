// iOS version - uses SwiftUI
import { Alert, StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";

export type TestContextMenuProps = {
  onDownload?: () => void;
  onAddToShelf?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

export function TestContextMenu({
  onDownload = () => Alert.alert("Download"),
  onAddToShelf = () => Alert.alert("Add to Shelf"),
  onShare = () => Alert.alert("Share"),
  onDelete = () => Alert.alert("Delete"),
}: TestContextMenuProps) {
  return (
    <Host style={styles.host}>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Trigger>
          <Button variant="bordered">Show Context Menu</Button>
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          <Button systemImage="arrow.down.circle" onPress={onDownload}>
            Download
          </Button>
          <Button systemImage="star" onPress={onAddToShelf}>
            Add to Shelf
          </Button>
          <Button systemImage="square.and.arrow.up" onPress={onShare}>
            Share
          </Button>
          <Button systemImage="trash" role="destructive" onPress={onDelete}>
            Delete
          </Button>
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 200,
    height: 50,
  },
});
