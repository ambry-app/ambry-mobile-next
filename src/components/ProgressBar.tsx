import { StyleSheet, View } from "react-native";

import { Colors } from "@/styles";

type ProgressBarProps = {
  position: number;
  duration: number;
};

export function ProgressBar(props: ProgressBarProps) {
  const { position, duration } = props;
  const percent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.progressBar}>
      <View
        style={[styles.progressBarFill, { width: `${percent}%` }]}
        testID={"progress-bar-fill"}
      ></View>
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
});
