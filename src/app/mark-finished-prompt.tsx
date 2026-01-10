import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  applyPlaythroughAction,
  finishPlaythrough,
  PlaythroughAction,
} from "@/services/playback-controls";
import { useSession } from "@/stores/session";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

export default function MarkFinishedPromptModal() {
  const { playthroughId, continuationAction: continuationActionString } =
    useLocalSearchParams<{
      playthroughId: string;
      continuationAction: string;
    }>();
  const continuationAction: PlaythroughAction = JSON.parse(
    continuationActionString,
  );
  const session = useSession((state) => state.session);

  if (!session) {
    return null;
  }

  const handleContinuation = async (session: Session) => {
    if (continuationAction.type === "promptForResume") {
      router.navigate({
        pathname: "/resume-prompt",
        params: { playthroughId: continuationAction.playthroughId },
      });
    } else {
      applyPlaythroughAction(session, continuationAction);
    }
  };

  const handleMarkAsFinished = async () => {
    router.back();
    await finishPlaythrough(session, playthroughId, { skipUnload: true });
    await handleContinuation(session);
  };

  const handleKeepInProgress = async () => {
    router.back();
    await handleContinuation(session);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mark as Finished?</Text>
      <Text style={styles.description}>
        You are almost done with the current book. Do you want to mark it as
        finished?
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.finishedButton}
          onPress={handleMarkAsFinished}
        >
          <Text style={styles.finishedButtonText}>Yes, Mark as Finished</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inProgressButton}
          onPress={handleKeepInProgress}
        >
          <Text style={styles.inProgressButtonText}>No, Keep in Progress</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    gap: 16,
    height: 350,
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
  finishedButton: {
    flex: 1,
    backgroundColor: Colors.lime[500],
    borderRadius: 8,
    paddingVertical: 12,
  },
  finishedButtonText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  inProgressButton: {
    flex: 1,
    backgroundColor: Colors.zinc[700],
    borderRadius: 8,
    paddingVertical: 12,
  },
  inProgressButtonText: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: Colors.zinc[800],
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: Colors.zinc[100],
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
