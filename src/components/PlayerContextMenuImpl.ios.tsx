// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host, Section } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

import { DownloadStatus } from "@/stores/downloads";

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
          <Button
            key={author.id}
            label={author.name}
            onPress={() => handleGoToPerson(author)}
          />
        ))}
      </Section>
    );
  };

  // Render narrator menu items (with threshold)
  const renderNarratorItems = () => {
    return (
      <Section title={narrators.length > 1 ? "Narrators" : "Narrator"}>
        {narrators.slice(0, NARRATOR_THRESHOLD).map((narrator) => (
          <Button
            key={narrator.id}
            label={narrator.name}
            onPress={() => handleGoToPerson(narrator)}
          />
        ))}
      </Section>
    );
  };

  return (
    <Host style={styles.host}>
      <ContextMenu>
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            modifiers={[frame({ width: 48, height: 48 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {/* Go to book */}
          <Button
            label="Go to book"
            systemImage="info.circle"
            onPress={handleGoToBook}
          />

          {/* Go to author(s) */}
          {renderAuthorItems()}

          {/* Go to narrator(s) */}
          {renderNarratorItems()}

          {/* Download (only if not already downloaded or downloading) */}
          {!downloadStatus && (
            <Button
              label="Download"
              systemImage="arrow.down.circle"
              onPress={handleDownload}
            />
          )}

          {/* Unload player */}
          <Button
            label="Unload player"
            systemImage="xmark"
            onPress={handleUnloadPlayer}
          />

          {/* Mark finished */}
          <Button
            label="Mark as finished"
            systemImage="flag.fill"
            onPress={handleMarkFinished}
          />

          {/* Abandon */}
          <Button
            label="Abandon"
            systemImage="xmark.circle"
            role="destructive"
            onPress={handleAbandon}
          />
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
