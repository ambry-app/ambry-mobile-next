import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { usePlayerUIState } from "@/stores/player-ui-state";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles";
import { secondsDisplay } from "@/utils";

import { ProgressBar } from "./ProgressBar";

export const PlayerProgressBar = memo(function PlayerProgressBar() {
  const seekPosition = usePlayerUIState((state) => state.seekPosition);
  const progress = useTrackPlayer((state) => state.progress);
  const playbackRate = useTrackPlayer((state) => state.playbackRate);

  // Use seekPosition if available (during seek accumulation), otherwise use position
  const displayPosition = seekPosition ?? progress.position;
  const displayPercent = seekPosition
    ? (seekPosition / progress.duration) * 100
    : progress.percent;

  return (
    <View>
      <ProgressBar percent={displayPercent} />
      <View style={styles.timeDisplayRow}>
        <Text style={styles.timeDisplayText}>
          {secondsDisplay(displayPosition)}
        </Text>
        <Text style={styles.timeDisplayText}>
          -
          {secondsDisplay(
            Math.max(progress.duration - displayPosition, 0) / playbackRate,
          )}
        </Text>
        <Text style={[styles.timeDisplayText, styles.percentText]}>
          {displayPercent.toFixed(1)}%
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
