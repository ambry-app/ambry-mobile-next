import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/shallow";

import { usePlayer } from "@/stores/player";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";

import { ProgressBar } from "./ProgressBar";

// Subscribes only to progressPercent (updates every 5s)
const PlayerProgressBarFill = memo(function PlayerProgressBarFill() {
  const progressPercent = usePlayer((state) => state.progressPercent);
  return <ProgressBar percent={progressPercent} />;
});

// Subscribes to position/duration/playbackRate (updates every 1s)
// Also subscribes to seekPosition to show pending seeks immediately
const TimeDisplays = memo(function TimeDisplays() {
  const { position, duration, playbackRate, progressPercent, seekPosition } =
    usePlayer(
      useShallow(
        ({
          position,
          duration,
          playbackRate,
          progressPercent,
          seekPosition,
        }) => ({
          position,
          duration,
          playbackRate,
          progressPercent,
          seekPosition,
        }),
      ),
    );

  // Use seekPosition if available (during seek accumulation), otherwise use position
  const displayPosition = seekPosition ?? position;

  return (
    <View style={styles.timeDisplayRow}>
      <Text style={styles.timeDisplayText}>
        {secondsDisplay(displayPosition)}
      </Text>
      <Text style={styles.timeDisplayText}>
        -
        {secondsDisplay(Math.max(duration - displayPosition, 0) / playbackRate)}
      </Text>
      <Text style={[styles.timeDisplayText, styles.percentText]}>
        {progressPercent.toFixed(1)}%
      </Text>
    </View>
  );
});

// Parent component that renders both - doesn't subscribe to position itself
export const PlayerProgressBar = memo(function PlayerProgressBar() {
  return (
    <View>
      <PlayerProgressBarFill />
      <TimeDisplays />
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
