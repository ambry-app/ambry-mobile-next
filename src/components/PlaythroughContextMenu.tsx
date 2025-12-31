// Android version (default) - uses Jetpack Compose
import { ReactElement, useCallback } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, ButtonProps, ContextMenu } from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { deletePlaythrough, PlaythroughForMedia } from "@/db/playthroughs";
import {
  abandonPlaythrough,
  continueExistingPlaythrough,
  finishPlaythrough,
  resumeAndLoadPlaythrough,
} from "@/services/playback-controls";
import { bumpPlaythroughDataVersion } from "@/stores/data-version";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

export type PlaythroughStatus = "in_progress" | "finished" | "abandoned";

export type PlaythroughContextMenuProps = {
  session: Session;
  playthrough: PlaythroughForMedia;
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
  session,
  playthrough,
}: PlaythroughContextMenuProps) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Playthrough",
      "Are you sure you want to delete this playthrough? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // FIXME: this needs to be a high level coordinator call, not a direct DB call + bump
            await deletePlaythrough(session, playthrough.id);
            bumpPlaythroughDataVersion();
          },
        },
      ],
    );
  }, [session, playthrough.id]);

  const menuItems: ReactElement<ButtonProps>[] = [];

  if (playthrough.status === "in_progress") {
    // Continue playthrough
    menuItems.push(
      <Button
        key="resume"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={() => {
          continueExistingPlaythrough(session, playthrough.id);
        }}
      >
        Resume
      </Button>,
    );
  } else if (
    playthrough.status === "finished" ||
    playthrough.status === "abandoned"
  ) {
    // Open resume prompt
    menuItems.push(
      <Button
        key="resume"
        leadingIcon="filled.PlayArrow"
        elementColors={menuColors}
        onPress={() => {
          resumeAndLoadPlaythrough(session, playthrough.id);
        }}
      >
        Resume
      </Button>,
    );
  }

  if (playthrough.status === "in_progress") {
    menuItems.push(
      <Button
        key="finish"
        leadingIcon="filled.CheckCircle"
        elementColors={menuColors}
        onPress={() => {
          finishPlaythrough(session, playthrough.id);
        }}
      >
        Mark as finished
      </Button>,
      <Button
        key="abandon"
        leadingIcon="filled.Close"
        elementColors={destructiveColors}
        onPress={() => {
          abandonPlaythrough(session, playthrough.id);
        }}
      >
        Abandon
      </Button>,
    );
  }

  // Delete is always available
  menuItems.push(
    <Button
      key="delete"
      leadingIcon="filled.Delete"
      elementColors={destructiveColors}
      onPress={handleDelete}
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
