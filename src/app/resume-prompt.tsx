import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Loading } from "@/components";
import {
  resumeAndLoadPlaythrough,
  startFreshPlaythrough,
} from "@/services/playback-controls";
import { usePlaythroughForPrompt } from "@/services/playthrough-query-service";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";
import { timeAgo } from "@/utils/date";

export default function ResumePromptModal() {
  const { playthroughId } = useLocalSearchParams<{ playthroughId: string }>();
  const { playthrough, session } = usePlaythroughForPrompt(playthroughId);

  if (!playthrough || !session) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    );
  }

  const { media, status, finishedAt, abandonedAt, stateCache } = playthrough;

  const statusDate = status === "finished" ? finishedAt : abandonedAt;

  let message = `You ${status} this book`;
  if (statusDate) {
    const relativeTime = timeAgo(statusDate);
    const daysSince = Math.floor(
      (Date.now() - statusDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const absoluteDate = statusDate.toLocaleDateString("en-US");
    const dateText = daysSince >= 7 ? ` (${absoluteDate})` : "";
    message += ` ${relativeTime}${dateText}.`;
  } else {
    message += ".";
  }

  if (status === "abandoned") {
    const position = stateCache?.currentPosition ?? 0;
    const duration = parseFloat(media.duration || "0");
    if (position > 0 && duration > 0) {
      const percentage = Math.round((position / duration) * 100);
      message += `\n\nYour last position was ${secondsDisplay(
        position,
      )} (${percentage}%).`;
    }
  }

  const handleResume = async () => {
    router.back();
    await resumeAndLoadPlaythrough(session, playthroughId);
  };

  const handleStartFresh = async () => {
    router.back();
    await startFreshPlaythrough(session, media.id);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resume or Start Fresh?</Text>
      <Text style={styles.description}>{message}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
          <Text style={styles.resumeButtonText}>Resume</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.startFreshButton}
          onPress={handleStartFresh}
        >
          <Text style={styles.startFreshButtonText}>Start Fresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    gap: 16,
    height: 250,
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
});
