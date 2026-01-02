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

  // Go to author(s)
  const singleAuthor = authors.length === 1 ? authors[0] : null;
  if (singleAuthor) {
    menuItems.push(
      <Button
        key="go-to-author"
        leadingIcon="filled.Person"
        elementColors={menuColors}
        onPress={() => handleGoToPerson(singleAuthor)}
      >
        Go to author: {singleAuthor.name}
      </Button>,
    );
  } else if (authors.length > 1) {
    menuItems.push(
      <Submenu
        key="go-to-author-submenu"
        button={
          <Button leadingIcon="filled.Person" elementColors={menuColors}>
            Go to author
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
  }

  // Go to narrator(s) - only if <= threshold
  const singleNarrator = narrators.length === 1 ? narrators[0] : null;
  if (singleNarrator) {
    menuItems.push(
      <Button
        key="go-to-narrator"
        leadingIcon="filled.Person"
        elementColors={menuColors}
        onPress={() => handleGoToPerson(singleNarrator)}
      >
        Go to narrator: {singleNarrator.name}
      </Button>,
    );
  } else if (narrators.length > 1 && narrators.length <= NARRATOR_THRESHOLD) {
    menuItems.push(
      <Submenu
        key="go-to-narrator-submenu"
        button={
          <Button leadingIcon="filled.Person" elementColors={menuColors}>
            Go to narrator
          </Button>
        }
      >
        {narrators.map((narrator) => (
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
  }

  // Download (only if not already downloaded or downloading)
  if (!downloadStatus) {
    menuItems.push(
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
  menuItems.push(
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
  menuItems.push(
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
  menuItems.push(
    <Button
      key="abandon"
      leadingIcon="filled.Close"
      elementColors={destructiveColors}
      onPress={handleAbandon}
    >
      Abandon
    </Button>,
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
