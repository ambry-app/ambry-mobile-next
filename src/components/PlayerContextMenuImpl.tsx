// Android version (default) - uses Jetpack Compose
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  ButtonProps,
  ContextMenu,
  Submenu,
} from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { DownloadStatus } from "@/stores/downloads";
import { Colors } from "@/styles";

type AuthorOrNarrator = {
  id: string;
  name: string;
  personId: string;
  personName: string;
};

export type PlayerContextMenuImplProps = {
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
  downloadStatus: DownloadStatus | undefined;
  handleGoToBook: () => void;
  handleGoToPerson: (item: AuthorOrNarrator) => void;
  handleUnloadPlayer: () => void;
  handleMarkFinished: () => void;
  handleAbandon: () => void;
  handleDownload: () => void;
};

const NARRATOR_THRESHOLD = 5;

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

export function PlayerContextMenuImpl({
  authors,
  narrators,
  downloadStatus,
  handleGoToBook,
  handleGoToPerson,
  handleUnloadPlayer,
  handleMarkFinished,
  handleAbandon,
  handleDownload,
}: PlayerContextMenuImplProps) {
  // Build menu items array
  const menuItems: ReactElement<ButtonProps>[] = [];
  const actionMenuItems: ReactElement<ButtonProps>[] = [];

  // Go to book
  menuItems.push(
    <Button
      key="go-to-book"
      leadingIcon="filled.Info"
      elementColors={menuColors}
      onPress={handleGoToBook}
    >
      Go to book
    </Button>,
  );

  menuItems.push(
    <Submenu
      key="go-to-author-submenu"
      button={
        <Button leadingIcon="filled.Person" elementColors={menuColors}>
          {authors.length > 1 ? "Authors" : "Author"}
        </Button>
      }
    >
      {authors.map((author) => (
        <Button
          key={author.id}
          elementColors={menuColors}
          onPress={() => handleGoToPerson(author)}
        >
          {author.name}
        </Button>
      ))}
    </Submenu>,
  );

  menuItems.push(
    <Submenu
      key="go-to-narrator-submenu"
      button={
        <Button leadingIcon="filled.Person" elementColors={menuColors}>
          {narrators.length > 1 ? "Narrators" : "Narrator"}
        </Button>
      }
    >
      {narrators.slice(0, NARRATOR_THRESHOLD).map((narrator) => (
        <Button
          key={narrator.id}
          elementColors={menuColors}
          onPress={() => handleGoToPerson(narrator)}
        >
          {narrator.name}
        </Button>
      ))}
    </Submenu>,
  );
  // }

  // Download (only if not already downloaded or downloading)
  if (!downloadStatus) {
    actionMenuItems.push(
      <Button
        key="download"
        leadingIcon="filled.KeyboardArrowDown"
        elementColors={menuColors}
        onPress={handleDownload}
      >
        Download
      </Button>,
    );
  }

  // Unload player
  actionMenuItems.push(
    <Button
      key="unload"
      leadingIcon="filled.Close"
      elementColors={menuColors}
      onPress={handleUnloadPlayer}
    >
      Unload player
    </Button>,
  );

  // Mark finished
  actionMenuItems.push(
    <Button
      key="mark-finished"
      leadingIcon="filled.CheckCircle"
      elementColors={menuColors}
      onPress={handleMarkFinished}
    >
      Mark as finished
    </Button>,
  );

  // Abandon
  actionMenuItems.push(
    <Button
      key="abandon"
      leadingIcon="filled.Close"
      elementColors={destructiveColors}
      onPress={handleAbandon}
    >
      Abandon
    </Button>,
  );

  menuItems.push(
    <Submenu
      key="actions-submenu"
      button={
        <Button leadingIcon="filled.Done" elementColors={menuColors}>
          Actions
        </Button>
      }
    >
      {actionMenuItems}
    </Submenu>,
  );

  return (
    <View style={styles.container}>
      {/* Icon layer - visible but doesn't receive touches */}
      <View style={styles.iconLayer} pointerEvents="none">
        <FontAwesome6
          name="ellipsis-vertical"
          size={24}
          color={Colors.zinc[100]}
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
    width: 48,
    height: 48,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  trigger: {
    width: 48,
    height: 48,
  },
});
