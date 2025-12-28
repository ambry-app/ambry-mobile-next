import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { usePlayer } from "@/stores/player";
import { Colors } from "@/styles";
import { secondsDisplayMinutesOnly } from "@/utils";

export function SeekIndicator() {
  const seekEffectiveDiff = usePlayer((state) => state.seekEffectiveDiff);
  const seekLastDirection = usePlayer((state) => state.seekLastDirection);

  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const wasVisibleRef = useRef(false);
  const lastDirectionRef = useRef<"left" | "right">("right");
  const prevDiffRef = useRef<number | null>(null);

  // Track the last known direction (preserve it during exit animation)
  if (seekLastDirection !== null) {
    lastDirectionRef.current = seekLastDirection;
  }

  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const scale = useSharedValue(1);

  // Position style based on direction (use ref to preserve during exit)
  // Use left for backward seeks, right for forward seeks (symmetric from edges)
  const positionStyle =
    lastDirectionRef.current === "left"
      ? ({ left: "12%" } as const)
      : ({ right: "12%" } as const);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    const prevDiff = prevDiffRef.current;

    if (seekEffectiveDiff !== null) {
      // Update display value
      setDisplayValue(secondsDisplayMinutesOnly(seekEffectiveDiff, true));

      if (!wasVisible) {
        // Entering: fade in and rise up
        setIsVisible(true);
        wasVisibleRef.current = true;

        translateY.value = 12;
        opacity.value = withTiming(1, { duration: 150 });
        translateY.value = withTiming(0, { duration: 200 });
      } else if (prevDiff !== seekEffectiveDiff) {
        // Already visible and value changed: scale pulse
        scale.value = withSequence(
          withTiming(1.15, { duration: 75 }),
          withTiming(1, { duration: 100 }),
        );
      }
    } else if (wasVisible) {
      // Exiting: fly away upward and fade out
      wasVisibleRef.current = false;

      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-24, { duration: 200 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsVisible, false);
        }
      });
    }

    prevDiffRef.current = seekEffectiveDiff;
  }, [seekEffectiveDiff, opacity, translateY, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, positionStyle, animatedStyle]}>
      <Text style={styles.text}>{displayValue}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -16,
  },
  text: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: Colors.zinc[100],
  },
});
