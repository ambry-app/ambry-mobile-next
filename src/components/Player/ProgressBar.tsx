import { usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { secondsDisplay } from "@/src/utils/time";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

export default function ProgressBar() {
  const { position, duration, playbackRate } = usePlayer(
    useShallow(({ position, duration, playbackRate }) => ({
      position,
      duration,
      playbackRate,
    })),
  );
  const percent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View>
      <View style={styles.progressBar}>
        <View style={[styles.progressBarFill, { width: `${percent}%` }]}></View>
      </View>
      <View style={styles.timeDisplayRow}>
        <Text style={styles.timeDisplayText}>{secondsDisplay(position)}</Text>
        <Text style={styles.timeDisplayText}>
          -{secondsDisplay(Math.max(duration - position, 0) / playbackRate)}
        </Text>
        <Text style={[styles.timeDisplayText, styles.percentText]}>
          {percent.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

const progressBarHeight = 2;
const styles = StyleSheet.create({
  progressBar: {
    height: progressBarHeight,
    width: "100%",
    backgroundColor: Colors.zinc[700],
  },
  progressBarFill: {
    height: progressBarHeight,
    backgroundColor: Colors.lime[400],
  },
  timeDisplayRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    position: "relative",
  },
  timeDisplayText: {
    color: Colors.zinc[400],
  },
  percentText: {
    position: "absolute",
    top: 4,
    width: "100%",
    textAlign: "center",
  },
});
