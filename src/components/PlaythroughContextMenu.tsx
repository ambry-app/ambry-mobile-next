// Android version (default) - uses Jetpack Compose
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ButtonProps, ContextMenu } from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { Colors } from "@/styles";

export type PlaythroughStatus = "in_progress" | "finished" | "abandoned";

export type PlaythroughContextMenuProps = {
  status: PlaythroughStatus;
  onContinue?: () => void;
  onResume?: () => void;
  onMarkFinished: () => void;
  onAbandon: () => void;
  onDelete: () => void;
};

const triggerColors = {
  containerColor: "transparent",
  contentColor: "transparent",
};

const menuColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.zinc[100],
};

const destructiveColors = {
  containerColor: Colors.zinc[800],
  contentColor: Colors.red[400],
};

export function PlaythroughContextMenu({
  status,
  onContinue,
  onResume,
  onMarkFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuProps) {
  // Build menu items array - Android ContextMenu doesn't support fragments or null children
  const menuItems: ReactElement<ButtonProps>[] = [];

  // Status-specific actions
  if (status === "in_progress" && onContinue) {
    menuItems.push(
      <Button
        key="continue"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={onContinue}
      >
        Continue
      </Button>,
      <Button
        key="mark-finished"
        leadingIcon="filled.CheckCircle"
        elementColors={menuColors}
        onPress={onMarkFinished}
      >
        Mark as finished
      </Button>,
      <Button
        key="abandon"
        leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={onAbandon}
      >
        Abandon
      </Button>,
    );
  }

  if ((status === "abandoned" || status === "finished") && onResume) {
    menuItems.push(
      <Button
        key="resume"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={onResume}
      >
        Resume
      </Button>,
    );
  }

  // Delete is always available
  menuItems.push(
    <Button
      key="delete"
      leadingIcon="filled.Delete"
      elementColors={destructiveColors}
      onPress={onDelete}
    >
      Delete playthrough
    </Button>,
  );

  return (
    <View style={styles.container}>
      {/* Icon layer - visible but doesn't receive touches */}
      <View style={styles.iconLayer} pointerEvents="none">
        <FontAwesome6
          name="ellipsis-vertical"
          size={16}
          color={Colors.zinc[500]}
        />
      </View>
      {/* Context menu with invisible trigger on top */}
      <ContextMenu color={Colors.zinc[800]}>
        <ContextMenu.Trigger>
          <Button elementColors={triggerColors} style={styles.trigger}>
            {" "}
          </Button>
        </ContextMenu.Trigger>
        <ContextMenu.Items>{menuItems}</ContextMenu.Items>
      </ContextMenu>
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
  trigger: {
    width: 44,
    height: 44,
  },
});
