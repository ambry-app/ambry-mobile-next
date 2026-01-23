// iOS version - uses SwiftUI
import { StyleSheet } from "react-native";
import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import { frame } from "@expo/ui/swift-ui/modifiers";

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

export function PlaythroughContextMenuImpl({
  status,
  onResume,
  onResumeFromPrevious,
  onMarkAsFinished,
  onAbandon,
  onDelete,
}: PlaythroughContextMenuImplProps) {
  return (
    <Host style={styles.host}>
      <ContextMenu>
        <ContextMenu.Trigger>
          <Button
            systemImage="ellipsis"
            modifiers={[frame({ width: 44, height: 44 })]}
          />
        </ContextMenu.Trigger>
        <ContextMenu.Items>
          {status === "in_progress" && (
            <Button label="Resume" systemImage="play.fill" onPress={onResume} />
          )}

          {(status === "finished" || status === "abandoned") && (
            <Button
              label="Resume"
              systemImage="play.fill"
              onPress={onResumeFromPrevious}
            />
          )}

          {status === "in_progress" && (
            <>
              <Button
                label="Mark as finished"
                systemImage="flag.fill"
                onPress={onMarkAsFinished}
              />
              <Button
                label="Abandon"
                systemImage="xmark.circle"
                role="destructive"
                onPress={onAbandon}
              />
            </>
          )}

          {/* Delete is always available */}
          <Button
            label="Delete playthrough"
            systemImage="trash"
            role="destructive"
            onPress={onDelete}
          />
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 44,
    height: 44,
  },
});
