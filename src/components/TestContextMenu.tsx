// Android version (default) - uses Jetpack Compose
import { Alert, StyleSheet } from "react-native";
import { Button, ContextMenu } from "@expo/ui/jetpack-compose";

import { Colors } from "@/styles";

export type TestContextMenuProps = {
  onDownload?: () => void;
  onAddToShelf?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

const defaultColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.zinc[100],
};

const destructiveColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.red[400],
};

export function TestContextMenu({
  onDownload = () => Alert.alert("Download"),
  onAddToShelf = () => Alert.alert("Add to Shelf"),
  onShare = () => Alert.alert("Share"),
  onDelete = () => Alert.alert("Delete"),
}: TestContextMenuProps) {
  return (
    <ContextMenu color={Colors.zinc[800]}>
      <ContextMenu.Trigger>
        <Button
          elementColors={defaultColors}
          variant="default"
          style={styles.trigger}
        >
          Show Context Menu
        </Button>
      </ContextMenu.Trigger>
      <ContextMenu.Items>
        <Button
          leadingIcon="filled.ArrowDropDown"
          elementColors={defaultColors}
          onPress={onDownload}
        >
          Download
        </Button>
        <Button
          leadingIcon="filled.Star"
          elementColors={defaultColors}
          onPress={onAddToShelf}
        >
          Add to Shelf
        </Button>
        <Button
          leadingIcon="filled.Share"
          elementColors={defaultColors}
          onPress={onShare}
        >
          Share
        </Button>
        <Button
          leadingIcon="filled.Delete"
          elementColors={destructiveColors}
          onPress={onDelete}
        >
          Delete
        </Button>
      </ContextMenu.Items>
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 200,
    height: 50,
  },
});
