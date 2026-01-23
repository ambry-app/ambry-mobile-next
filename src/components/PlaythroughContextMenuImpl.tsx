// Android version (default) - uses Jetpack Compose
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  ButtonProps,
  ContextMenu,
  Host,
} from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { Colors } from "@/styles/colors";

export type PlaythroughStatus =
  | "in_progress"
  | "finished"
  | "abandoned"
  | "deleted";

export type PlaythroughContextMenuImplProps = {
  status: PlaythroughStatus;
  onResume: () => void;
  onResumeFromPrevious: () => void;
  onMarkAsFinished: () => void;
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

export function PlaythroughContextMenuImpl({
  status,
  onResume,
  onResumeFromPrevious,
  onMarkAsFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuImplProps) {
  const menuItems: ReactElement<ButtonProps>[] = [];

  if (status === "in_progress") {
    // Continue playthrough
    menuItems.push(
      <Button
        key="resume"
        //leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={onResume}
      >
        Resume
      </Button>,
    );
  } else if (status === "finished" || status === "abandoned") {
    // Open resume prompt
    menuItems.push(
      <Button
        key="resume"
        //leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={onResumeFromPrevious}
      >
        Resume
      </Button>,
    );
  }

  if (status === "in_progress") {
    menuItems.push(
      <Button
        key="finish"
        //leadingIcon="filled.CheckCircle"
        elementColors={menuColors}
        onPress={onMarkAsFinished}
      >
        Mark as finished
      </Button>,
      <Button
        key="abandon"
        //leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={onAbandon}
      >
        Abandon
      </Button>,
    );
  }

  // Delete is always available
  menuItems.push(
    <Button
      key="delete"
      //leadingIcon="filled.Delete"
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
      <Host matchContents style={styles.host}>
        <ContextMenu color={Colors.zinc[800]}>
          <ContextMenu.Trigger>
            <Button elementColors={triggerColors}> </Button>
          </ContextMenu.Trigger>
          <ContextMenu.Items>{menuItems}</ContextMenu.Items>
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
    backgroundColor: "transparent",
  },
});
