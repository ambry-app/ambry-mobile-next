import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import { secondsDisplay } from "@/src/utils/time";
import { StyleSheet, Text, View } from "react-native";
import colors from "tailwindcss/colors";

export default function PlayerProgressBar() {
  const { position, duration } = useTrackPlayerStore((state) => state);
  const percent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      <View style={styles.progressBar}>
        <View style={[styles.progressBarFill, { width: `${percent}%` }]}></View>
      </View>
      <View style={styles.timeDisplayRow}>
        <Text style={styles.timeDisplayText}>{secondsDisplay(position)}</Text>
        <Text style={styles.timeDisplayText}>
          -{secondsDisplay(Math.max(duration - position, 0))}
        </Text>
      </View>
    </>
  );
}

const progressBarHeight = 2;
const styles = StyleSheet.create({
  progressBar: {
    height: progressBarHeight,
    width: "100%",
    backgroundColor: colors.zinc[700],
  },
  progressBarFill: {
    height: progressBarHeight,
    backgroundColor: colors.lime[400],
  },
  timeDisplayRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  timeDisplayText: {
    color: colors.zinc[400],
  },
});
