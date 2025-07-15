import { usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { secondsDisplay } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { ProgressBar } from "./ProgressBar";

export function PlayerProgressBar() {
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
      <ProgressBar position={position} duration={duration} />
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

const styles = StyleSheet.create({
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
