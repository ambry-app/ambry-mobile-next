import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/shallow";

import { usePlayer } from "@/stores/player";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";

import { ProgressBar } from "./ProgressBar";

// Subscribes to position/duration/playbackRate/seekPosition (updates every 1s, or immediately on seek)
export const PlayerProgressBar = memo(function PlayerProgressBar() {
  const { position, duration, playbackRate, seekPosition } = usePlayer(
    useShallow(({ position, duration, playbackRate, seekPosition }) => ({
      position,
      duration,
      playbackRate,
      seekPosition,
    })),
  );

  // Use seekPosition if available (during seek accumulation), otherwise use position
  const displayPosition = seekPosition ?? position;
  const progressPercent = duration > 0 ? (displayPosition / duration) * 100 : 0;

  return (
    <View>
      <ProgressBar percent={progressPercent} />
      <View style={styles.timeDisplayRow}>
        <Text style={styles.timeDisplayText}>
          {secondsDisplay(displayPosition)}
        </Text>
        <Text style={styles.timeDisplayText}>
          -
          {secondsDisplay(
            Math.max(duration - displayPosition, 0) / playbackRate,
          )}
        </Text>
        <Text style={[styles.timeDisplayText, styles.percentText]}>
          {progressPercent.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
});

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
