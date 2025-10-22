import { usePlayer } from "@/src/stores/player";
import { Colors } from "@/src/styles";
import { secondsDisplayMinutesOnly } from "@/src/utils";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useSharedValue, withTiming } from "react-native-reanimated";

export function SeekIndicator() {
  const seekEffectiveDiff = usePlayer((state) => state.seekEffectiveDiff);
  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (seekEffectiveDiff !== null) {
      setDisplayValue(secondsDisplayMinutesOnly(seekEffectiveDiff, true));
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [seekEffectiveDiff, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{displayValue}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},
  text: {
    textAlign: "center",
    fontSize: 14,
    color: Colors.zinc[400],
  },
});
