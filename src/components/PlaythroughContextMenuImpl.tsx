// Android version (default) - uses Jetpack Compose
import { ReactElement } from "react";
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

import { Colors } from "@/styles/colors";
import { useMenuState } from "@/utils/hooks";

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
  textColor: Colors.zinc[100],
};

const destructiveColors = {
  textColor: Colors.red[400],
};

export function PlaythroughContextMenuImpl({
  status,
  onResume,
  onResumeFromPrevious,
  onMarkAsFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuImplProps) {
  const { expanded, open, close, selecting } = useMenuState();

  const menuItems: ReactElement[] = [];

  if (status === "in_progress") {
    // Continue playthrough
    menuItems.push(
      <DropdownMenuItem
        key="resume"
        elementColors={menuColors}
        onClick={selecting(onResume)}
      >
        <DropdownMenuItem.Text>
          <Text>Resume</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  } else if (status === "finished" || status === "abandoned") {
    // Open resume prompt
    menuItems.push(
      <DropdownMenuItem
        key="resume"
        elementColors={menuColors}
        onClick={selecting(onResumeFromPrevious)}
      >
        <DropdownMenuItem.Text>
          <Text>Resume</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  if (status === "in_progress") {
    menuItems.push(
      <DropdownMenuItem
        key="finish"
        elementColors={menuColors}
        onClick={selecting(onMarkAsFinished)}
      >
        <DropdownMenuItem.Text>
          <Text>Mark as finished</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
      <DropdownMenuItem
        key="abandon"
        elementColors={destructiveColors}
        onClick={selecting(onAbandon)}
      >
        <DropdownMenuItem.Text>
          <Text>Abandon</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  // Delete is always available
  menuItems.push(
    <DropdownMenuItem
      key="delete"
      elementColors={destructiveColors}
      onClick={selecting(onDelete)}
    >
      <DropdownMenuItem.Text>
        <Text>Delete playthrough</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
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
      <Host style={styles.host}>
        <DropdownMenu
          color={Colors.zinc[800]}
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
          <DropdownMenu.Items>{menuItems}</DropdownMenu.Items>
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
