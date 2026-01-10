// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host, Section } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { DownloadStatus } from "@/stores/downloads";
import { Colors } from "@/styles/colors";

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
    return (
      <Section title={authors.length > 1 ? "Authors" : "Author"}>
        {authors.map((author) => (
          <Button key={author.id} onPress={() => handleGoToPerson(author)}>
            {author.name}
          </Button>
        ))}
      </Section>
    );
  };

  // Render narrator menu items (with threshold)
  const renderNarratorItems = () => {
    return (
      <Section title={narrators.length > 1 ? "Narrators" : "Narrator"}>
        {narrators.slice(0, NARRATOR_THRESHOLD).map((narrator) => (
          <Button key={narrator.id} onPress={() => handleGoToPerson(narrator)}>
            {narrator.name}
          </Button>
        ))}
      </Section>
    );
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
