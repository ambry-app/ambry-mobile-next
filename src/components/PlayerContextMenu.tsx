// Android version (default) - uses Jetpack Compose
import { ReactElement, useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  ButtonProps,
  ContextMenu,
  Submenu,
} from "@expo/ui/jetpack-compose";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { getActivePlaythrough } from "@/db/playthroughs";
import {
  abandonPlaythrough,
  finishPlaythrough,
} from "@/services/playthrough-lifecycle";
import { tryUnloadPlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type AuthorOrNarrator = {
  id: string;
  name: string;
  personId: string;
  personName: string;
};

export type PlayerContextMenuProps = {
  session: Session;
  mediaId: string;
  bookTitle: string;
  authors: AuthorOrNarrator[];
  narrators: AuthorOrNarrator[];
  onCollapse: () => void;
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

export function PlayerContextMenu({
  session,
  mediaId,
  bookTitle,
  authors,
  narrators,
  onCollapse,
}: PlayerContextMenuProps) {
  const [playthroughId, setPlaythroughId] = useState<string | null>(null);
  const [isInProgress, setIsInProgress] = useState(false);

  // Fetch playthrough state
  useEffect(() => {
    async function fetchPlaythrough() {
      const active = await getActivePlaythrough(session, mediaId);
      if (active) {
        setPlaythroughId(active.id);
        setIsInProgress(true);
      } else {
        setPlaythroughId(null);
        setIsInProgress(false);
      }
    }
    fetchPlaythrough();
  }, [session, mediaId]);

  const handleGoToBook = useCallback(() => {
    onCollapse();
    router.navigate({
      pathname: "/media/[id]",
      params: { id: mediaId, title: bookTitle },
    });
  }, [mediaId, bookTitle, onCollapse]);

  const handleGoToPerson = useCallback(
    (item: AuthorOrNarrator) => {
      onCollapse();
      router.navigate({
        pathname: "/person/[id]",
        params: { id: item.personId, title: item.personName },
      });
    },
    [onCollapse],
  );

  const handleUnloadPlayer = useCallback(async () => {
    await tryUnloadPlayer();
  }, []);

  const handleMarkFinished = useCallback(async () => {
    if (!playthroughId) return;
    await finishPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

  const handleAbandon = useCallback(async () => {
    if (!playthroughId) return;
    await abandonPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

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

  // Mark finished (only if in progress)
  if (isInProgress) {
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
  }

  // Abandon (only if in progress)
  if (isInProgress) {
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
  }

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
