// iOS version - uses SwiftUI
import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

import { getActivePlaythrough } from "@/db/playthroughs";
import * as Transitions from "@/services/playthrough-transitions";
import { startDownload, useDownloads } from "@/stores/downloads";
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
  const downloadStatus = useDownloads(
    (state) => state.downloads[mediaId]?.status,
  );

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
    await Transitions.unloadPlayer(session);
  }, [session]);

  const handleMarkFinished = useCallback(async () => {
    if (!playthroughId) return;
    await Transitions.finishPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

  const handleAbandon = useCallback(async () => {
    if (!playthroughId) return;
    await Transitions.abandonPlaythrough(session, playthroughId);
  }, [session, playthroughId]);

  const handleDownload = useCallback(() => {
    startDownload(session, mediaId);
    router.navigate("/downloads");
  }, [session, mediaId]);

  // Render author menu items
  const renderAuthorItems = () => {
    const singleAuthor = authors.length === 1 ? authors[0] : null;
    if (singleAuthor) {
      return (
        <Button
          systemImage="person.fill"
          onPress={() => handleGoToPerson(singleAuthor)}
        >
          Go to author: {singleAuthor.name}
        </Button>
      );
    }
    if (authors.length > 1) {
      return (
        <ContextMenu>
          <ContextMenu.Trigger>
            <Button systemImage="person.fill">Go to author</Button>
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {authors.map((author) => (
              <Button key={author.id} onPress={() => handleGoToPerson(author)}>
                {author.name}
              </Button>
            ))}
          </ContextMenu.Items>
        </ContextMenu>
      );
    }
    return null;
  };

  // Render narrator menu items (only if <= threshold)
  const renderNarratorItems = () => {
    const singleNarrator = narrators.length === 1 ? narrators[0] : null;
    if (singleNarrator) {
      return (
        <Button
          systemImage="person.fill"
          onPress={() => handleGoToPerson(singleNarrator)}
        >
          Go to narrator: {singleNarrator.name}
        </Button>
      );
    }
    if (narrators.length > 1 && narrators.length <= NARRATOR_THRESHOLD) {
      return (
        <ContextMenu>
          <ContextMenu.Trigger>
            <Button systemImage="person.fill">Go to narrator</Button>
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            {narrators.map((narrator) => (
              <Button
                key={narrator.id}
                onPress={() => handleGoToPerson(narrator)}
              >
                {narrator.name}
              </Button>
            ))}
          </ContextMenu.Items>
        </ContextMenu>
      );
    }
    return null;
  };

  return (
    <Host style={styles.host}>
      <ContextMenu activationMethod="singlePress">
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            variant="borderless"
            color={Colors.zinc[100]}
            controlSize="large"
            modifiers={[frame({ width: 48, height: 48 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {/* Go to book */}
          <Button systemImage="info.circle" onPress={handleGoToBook}>
            Go to book
          </Button>

          {/* Go to author(s) */}
          {renderAuthorItems()}

          {/* Go to narrator(s) */}
          {renderNarratorItems()}

          {/* Download (only if not already downloaded or downloading) */}
          {!downloadStatus && (
            <Button systemImage="arrow.down.circle" onPress={handleDownload}>
              Download
            </Button>
          )}

          {/* Unload player */}
          <Button systemImage="xmark" onPress={handleUnloadPlayer}>
            Unload player
          </Button>

          {/* Mark finished (only if in progress) */}
          {isInProgress && (
            <>
              <Button systemImage="flag.fill" onPress={handleMarkFinished}>
                Mark as finished
              </Button>
              <Button
                systemImage="xmark.circle"
                role="destructive"
                onPress={handleAbandon}
              >
                Abandon
              </Button>
            </>
          )}
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 48,
    height: 48,
  },
});
