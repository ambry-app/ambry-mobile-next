import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cancelResumePrompt,
  handleResumePlaythrough,
  handleStartFresh,
  PendingResumePrompt,
  usePlayer,
} from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";

type ResumePlaythroughDialogProps = {
  session: Session;
  prompt: PendingResumePrompt;
};

export function ResumePlaythroughDialog({
  session,
  prompt,
}: ResumePlaythroughDialogProps) {
  const { top, bottom } = useSafeAreaInsets();
  const loadingNewMedia = usePlayer((state) => state.loadingNewMedia);

  const statusText =
    prompt.playthroughStatus === "finished"
      ? "You've previously finished this book."
      : "You've previously abandoned this book.";

  const positionText =
    prompt.position > 0
      ? `Your last position was ${secondsDisplay(prompt.position)}.`
      : null;

  return (
    <View
      style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Resume or Start Fresh?</Text>
        <Text style={styles.description}>{statusText}</Text>
        {positionText && <Text style={styles.description}>{positionText}</Text>}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.resumeButton,
              loadingNewMedia && styles.disabledButton,
            ]}
            onPress={() => handleResumePlaythrough(session)}
            disabled={loadingNewMedia}
          >
            <Text style={styles.resumeButtonText}>Resume</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.startFreshButton,
              loadingNewMedia && styles.disabledButton,
            ]}
            onPress={() => handleStartFresh(session)}
            disabled={loadingNewMedia}
          >
            <Text style={styles.startFreshButtonText}>Start Fresh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.cancelButton,
            loadingNewMedia && styles.disabledButton,
          ]}
          onPress={() => cancelResumePrompt()}
          disabled={loadingNewMedia}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  content: {
    width: "80%",
    maxWidth: 320,
    backgroundColor: Colors.zinc[800],
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  description: {
    color: Colors.zinc[400],
    fontSize: 14,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: Colors.lime[500],
    borderRadius: 8,
    paddingVertical: 12,
  },
  resumeButtonText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  startFreshButton: {
    flex: 1,
    backgroundColor: Colors.zinc[700],
    borderRadius: 8,
    paddingVertical: 12,
  },
  startFreshButtonText: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: Colors.zinc[500],
    fontSize: 14,
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
