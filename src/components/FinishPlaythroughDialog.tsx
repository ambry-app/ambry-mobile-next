import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cancelFinishPrompt,
  handleMarkFinished,
  handleSkipFinish,
  PendingFinishPrompt,
  usePlayer,
} from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type FinishPlaythroughDialogProps = {
  session: Session;
  prompt: PendingFinishPrompt;
};

export function FinishPlaythroughDialog({
  session,
  prompt,
}: FinishPlaythroughDialogProps) {
  const { top, bottom } = useSafeAreaInsets();
  const loadingNewMedia = usePlayer((state) => state.loadingNewMedia);

  const percentage =
    prompt.currentDuration > 0
      ? Math.round((prompt.currentPosition / prompt.currentDuration) * 100)
      : 0;

  return (
    <Pressable
      style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}
      onPress={() => !loadingNewMedia && cancelFinishPrompt()}
    >
      <Pressable style={styles.content} onPress={() => {}}>
        <Text style={styles.title}>Mark as Finished?</Text>
        <Text style={styles.description}>
          You're {percentage}% through "{prompt.currentMediaTitle}".
        </Text>
        <Text style={styles.description}>
          Would you like to mark it as finished?
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.finishButton,
              loadingNewMedia && styles.disabledButton,
            ]}
            onPress={() => handleMarkFinished(session)}
            disabled={loadingNewMedia}
          >
            <Text style={styles.finishButtonText}>Mark Finished</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.skipButton,
              loadingNewMedia && styles.disabledButton,
            ]}
            onPress={() => handleSkipFinish(session)}
            disabled={loadingNewMedia}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.cancelButton,
            loadingNewMedia && styles.disabledButton,
          ]}
          onPress={() => cancelFinishPrompt()}
          disabled={loadingNewMedia}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
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
  finishButton: {
    flex: 1,
    backgroundColor: Colors.lime[500],
    borderRadius: 8,
    paddingVertical: 12,
  },
  finishButtonText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  skipButton: {
    flex: 1,
    backgroundColor: Colors.zinc[700],
    borderRadius: 8,
    paddingVertical: 12,
  },
  skipButtonText: {
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
