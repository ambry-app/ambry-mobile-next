// Android version (default) - uses Jetpack Compose
import { StyleSheet, View } from "react-native";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  Host,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { Colors, interactive } from "@/styles/colors";
import { useMenuState } from "@/utils/hooks";

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
  textColor: Colors.zinc[100],
};

const destructiveColors = {
  textColor: Colors.red[400],
};

export function DownloadContextMenu({
  status,
  onDelete,
  onCancel,
}: DownloadContextMenuProps) {
  const { expanded, open, close, selecting } = useMenuState();

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
        <DropdownMenu
          color={interactive.fill}
          expanded={expanded}
          onDismissRequest={close}
        >
          <DropdownMenu.Trigger>
            <Button
              colors={triggerColors}
              modifiers={[fillMaxSize()]}
              onClick={open}
            >
              <Spacer />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {status === "ready" ? (
              <DropdownMenuItem
                elementColors={destructiveColors}
                onClick={selecting(onDelete)}
              >
                <DropdownMenuItem.Text>
                  <Text>Delete downloaded files</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                elementColors={menuColors}
                onClick={selecting(onCancel)}
              >
                <DropdownMenuItem.Text>
                  <Text>Cancel download</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            )}
          </DropdownMenu.Items>
        </DropdownMenu>
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
