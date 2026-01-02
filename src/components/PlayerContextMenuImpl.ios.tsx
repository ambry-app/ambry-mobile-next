// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

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

          {/* Mark finished */}
          <Button systemImage="flag.fill" onPress={handleMarkFinished}>
            Mark as finished
          </Button>

          {/* Abandon */}
          <Button
            systemImage="xmark.circle"
            role="destructive"
            onPress={handleAbandon}
          >
            Abandon
          </Button>
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
