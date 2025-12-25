// Android version (default) - uses Jetpack Compose
import { Alert } from "react-native";
import { Button, ContextMenu } from "@expo/ui/jetpack-compose";

import { Colors } from "@/styles";

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
    <ContextMenu color={Colors.zinc[800]}>
      <ContextMenu.Trigger>
        <Button
          elementColors={{
            containerColor: Colors.zinc[800],
            contentColor: Colors.zinc[100],
          }}
          variant="default"
          style={{ width: 200, height: 50 }}
        >
          Show Context Menu
        </Button>
      </ContextMenu.Trigger>
      <ContextMenu.Items>
        <Button
          leadingIcon="filled.ArrowDropDown"
          elementColors={{
            containerColor: Colors.zinc[800],
            contentColor: Colors.zinc[100],
          }}
          onPress={onDownload}
        >
          Download
        </Button>
        <Button
          leadingIcon="filled.Star"
          elementColors={{
            containerColor: Colors.zinc[800],
            contentColor: Colors.zinc[100],
          }}
          onPress={onAddToShelf}
        >
          Add to Shelf
        </Button>
        <Button
          leadingIcon="filled.Share"
          elementColors={{
            containerColor: Colors.zinc[800],
            contentColor: Colors.zinc[100],
          }}
          onPress={onShare}
        >
          Share
        </Button>
        <Button
          leadingIcon="filled.Delete"
          elementColors={{
            containerColor: Colors.zinc[800],
            contentColor: Colors.red[400],
          }}
          onPress={onDelete}
        >
          Delete
        </Button>
      </ContextMenu.Items>
    </ContextMenu>
  );
}
