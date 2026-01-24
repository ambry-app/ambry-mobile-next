// Android version (default) - uses Jetpack Compose
import { StyleSheet, View } from "react-native";
import {
  Button,
  ContextMenu,
  fillMaxSize,
  Host,
} from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { Colors, interactive } from "@/styles/colors";

export type DownloadContextMenuProps = {
  status: "pending" | "downloading" | "ready" | "error";
  onDelete: () => void;
  onCancel: () => void;
};

const triggerColors = {
  containerColor: "transparent",
  contentColor: "transparent",
};

const menuColors = {
  containerColor: interactive.fill,
  contentColor: Colors.zinc[100],
};

const destructiveColors = {
  containerColor: interactive.fill,
  contentColor: Colors.red[400],
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
        <ContextMenu color={Colors.zinc[800]}>
          <ContextMenu.Trigger>
            <Button elementColors={triggerColors} modifiers={[fillMaxSize()]}>
              {" "}
            </Button>
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {status === "ready" ? (
              <Button
                //leadingIcon="filled.Delete"
                elementColors={destructiveColors}
                onPress={onDelete}
              >
                Delete downloaded files
              </Button>
            ) : (
              <Button
                //leadingIcon="filled.Close"
                elementColors={menuColors}
                onPress={onCancel}
              >
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
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  host: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
});
