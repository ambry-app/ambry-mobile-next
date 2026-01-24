// Android version (default) - uses Jetpack Compose
import { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  HorizontalDivider,
  Host,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { DownloadStatus } from "@/stores/downloads";
import { Colors, interactive } from "@/styles/colors";
import { useMenuState } from "@/utils/hooks";

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
  textColor: Colors.zinc[100],
};

const destructiveColors = {
  textColor: Colors.red[400],
};

const headerColors = {
  disabledTextColor: Colors.zinc[400],
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
  const { expanded, open, close, selecting } = useMenuState();

  // Jetpack Compose has no nested-submenu primitive, so people are grouped into
  // labelled sections the same way the iOS implementation uses <Section>.
  const menuItems: ReactElement[] = [];

  const pushSection = (
    key: string,
    title: string,
    people: AuthorOrNarrator[],
  ) => {
    if (people.length === 0) return;

    menuItems.push(<HorizontalDivider key={`${key}-divider`} />);
    menuItems.push(
      <DropdownMenuItem
        key={`${key}-header`}
        enabled={false}
        elementColors={headerColors}
      >
        <DropdownMenuItem.Text>
          <Text>{title}</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
    people.forEach((person) => {
      menuItems.push(
        <DropdownMenuItem
          key={person.id}
          elementColors={menuColors}
          onClick={selecting(() => handleGoToPerson(person))}
        >
          <DropdownMenuItem.Text>
            <Text>{person.name}</Text>
          </DropdownMenuItem.Text>
        </DropdownMenuItem>,
      );
    });
  };

  // Go to book
  menuItems.push(
    <DropdownMenuItem
      key="go-to-book"
      elementColors={menuColors}
      onClick={selecting(handleGoToBook)}
    >
      <DropdownMenuItem.Text>
        <Text>Go to book</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
  );

  pushSection("authors", authors.length > 1 ? "Authors" : "Author", authors);
  pushSection(
    "narrators",
    narrators.length > 1 ? "Narrators" : "Narrator",
    narrators.slice(0, NARRATOR_THRESHOLD),
  );

  menuItems.push(<HorizontalDivider key="actions-divider" />);

  // Download (only if not already downloaded or downloading)
  if (!downloadStatus) {
    menuItems.push(
      <DropdownMenuItem
        key="download"
        elementColors={menuColors}
        onClick={selecting(handleDownload)}
      >
        <DropdownMenuItem.Text>
          <Text>Download</Text>
        </DropdownMenuItem.Text>
      </DropdownMenuItem>,
    );
  }

  // Unload player
  menuItems.push(
    <DropdownMenuItem
      key="unload"
      elementColors={menuColors}
      onClick={selecting(handleUnloadPlayer)}
    >
      <DropdownMenuItem.Text>
        <Text>Unload player</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
  );

  // Mark finished
  menuItems.push(
    <DropdownMenuItem
      key="mark-finished"
      elementColors={menuColors}
      onClick={selecting(handleMarkFinished)}
    >
      <DropdownMenuItem.Text>
        <Text>Mark as finished</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
  );

  // Abandon
  menuItems.push(
    <DropdownMenuItem
      key="abandon"
      elementColors={destructiveColors}
      onClick={selecting(handleAbandon)}
    >
      <DropdownMenuItem.Text>
        <Text>Abandon</Text>
      </DropdownMenuItem.Text>
    </DropdownMenuItem>,
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
          <DropdownMenu.Items>{menuItems}</DropdownMenu.Items>
        </DropdownMenu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    height: "100%",
    aspectRatio: 1,
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
