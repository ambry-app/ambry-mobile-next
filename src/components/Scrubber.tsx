import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, TextInput } from "react-native";
import {
  Gesture,
  GestureDetector,
  type PanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useShallow } from "zustand/shallow";

import { seekTo } from "@/services/seek-service";
import * as Player from "@/services/trackplayer-wrapper";
import { State, usePlaybackState } from "@/services/trackplayer-wrapper";
import { SeekSource, usePlayerUIState } from "@/stores/player-ui-state";
import { Colors } from "@/styles";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const SPACING = 10; // pixels between ticks
const FACTOR = SPACING / 5; // 5 seconds per tick

const WIDTH = Dimensions.get("window").width;
const HEIGHT = 60;
const HALF_WIDTH = WIDTH / 2;
const NUM_TICKS = Math.ceil(WIDTH / SPACING);

const DRIFT_CORRECTION_INTERVAL = 5000;

const DECAY_VELOCITY_CUTOFF = 100;

const clamp = (value: number, lowerBound: number, upperBound: number) => {
  "worklet";
  return Math.min(Math.max(lowerBound, value), upperBound);
};

function friction(value: number) {
  "worklet";

  const MAX_FRICTION = 200;
  const MAX_VALUE = 400;

  const res = Math.max(
    1,
    Math.min(
      MAX_FRICTION,
      1 + (Math.abs(value) * (MAX_FRICTION - 1)) / MAX_VALUE,
    ),
  );

  if (value < 0) {
    return -res;
  }

  return res;
}

function timeToTranslateX(time: number) {
  "worklet";
  return time * -FACTOR;
}

function translateXToTime(translateX: number) {
  "worklet";
  return translateX / -FACTOR;
}

function useIsScrubbing() {
  const [isScrubbing, _setIsScrubbing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  const setIsScrubbing = useCallback(
    (newValue: boolean) => {
      if (newValue) {
        // if true, set immediately
        _setIsScrubbing(true);
        // and cancel any active timer that may be waiting
        clearTimeout(timerRef.current);
      } else {
        // if false, delay by 1 second
        timerRef.current = setTimeout(() => {
          _setIsScrubbing(false);
        }, 1000);
      }
    },
    [timerRef],
  );

  return [isScrubbing, setIsScrubbing] as [
    boolean,
    (newValue: boolean) => void,
  ];
}

const Ticks = memo(function Ticks() {
  return (
    <Svg height={HEIGHT} width={WIDTH + 120}>
      {Array.from({ length: NUM_TICKS + 12 }, (_, i) => (
        <Line
          key={i}
          x1={0.5 + i * SPACING}
          y1={0}
          x2={0.5 + i * SPACING}
          y2={i % 12 === 0 ? 40 : i % 6 === 0 ? 32 : 24}
          stroke={
            i % 12 === 0
              ? colors.emphasized
              : i % 6 === 0
                ? colors.normal
                : colors.dimmed
          }
          strokeWidth="1"
        />
      ))}
    </Svg>
  );
});

type MarkersProps = {
  markers: number[];
};

const Markers = memo(function Markers({ markers }: MarkersProps) {
  return markers.map((marker, i) => {
    return (
      <Svg
        height={12}
        width={5}
        key={i}
        style={[styles.marker, { left: marker * FACTOR }]}
      >
        <Rect
          x="0" // eslint-disable-line @typescript-eslint/no-deprecated
          y="0" // eslint-disable-line @typescript-eslint/no-deprecated
          rx="2.5"
          ry="2.5"
          height="12"
          width="5"
          fill={colors.accent}
          stroke={colors.weak}
          strokeWidth="2"
        />
      </Svg>
    );
  });
});

export const Scrubber = memo(function Scrubber({
  playerPanGesture,
}: {
  playerPanGesture: PanGesture;
}) {
  const { state } = usePlaybackState();
  const { playbackRate, chapters, duration } = usePlayerUIState(
    useShallow(({ playbackRate, chapters, duration }) => ({
      playbackRate,
      chapters,
      duration,
    })),
  );
  const { lastSeekTimestamp, lastSeekSource } = usePlayerUIState(
    useShallow(({ lastSeekTimestamp, lastSeekSource }) => ({
      lastSeekTimestamp,
      lastSeekSource,
    })),
  );
  const playing = state === State.Playing;
  const markers = chapters?.map((chapter) => chapter.startTime) || [];

  const initialPosition = useRef(usePlayerUIState.getState().position);
  const translateX = useSharedValue(timeToTranslateX(initialPosition.current));
  const [isScrubbing, setIsScrubbing] = useIsScrubbing();
  const maxTranslateX = timeToTranslateX(duration);
  const startX = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const isAnimatingUserSeek = useSharedValue(false);
  const timecodeOpacity = useSharedValue(0);
  const lastTimestamp = useSharedValue(0);

  // Correct initial translateX value once on mount
  useEffect(() => {
    const setAccurateInitialPosition = async () => {
      try {
        const { position } = await Player.getProgress();
        translateX.value = timeToTranslateX(position);
      } catch (e) {
        console.warn("[Scrubber] Error getting accurate initial progress:", e);
      }
    };
    setAccurateInitialPosition();
  }, [translateX]);

  const panGestureHandler = Gesture.Pan()
    .blocksExternalGesture(playerPanGesture)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart((_event) => {
      scheduleOnRN(setIsScrubbing, true);
      const currentX = translateX.value;
      startX.value = currentX;
      translateX.value = currentX;
    })
    .onUpdate((event) => {
      const nextTranslateX = startX.value + event.translationX;

      if (nextTranslateX < maxTranslateX) {
        translateX.value =
          maxTranslateX + friction(nextTranslateX - maxTranslateX);
      } else if (nextTranslateX > 0) {
        translateX.value = friction(nextTranslateX);
      } else {
        translateX.value = nextTranslateX;
      }
    })
    .onEnd((event) => {
      const lowVelocity = Math.abs(event.velocityX) < DECAY_VELOCITY_CUTOFF;

      if (lowVelocity) {
        // Low velocity, leave at current position without decay
        if (Math.abs(translateX.value - startX.value) >= 1) {
          // only seek if position changed
          const newPosition = translateXToTime(translateX.value);
          scheduleOnRN(seekTo, newPosition, SeekSource.SCRUBBER);
        }
        scheduleOnRN(setIsScrubbing, false);
        return;
      }

      const onFinish = (finished: boolean | undefined) => {
        isAnimating.value = false;

        if (finished) {
          if (Math.abs(translateX.value - startX.value) !== 0) {
            const newPosition = translateXToTime(translateX.value);
            scheduleOnRN(seekTo, newPosition, SeekSource.SCRUBBER);
          }
          scheduleOnRN(setIsScrubbing, false);
        }
      };

      isAnimating.value = true;

      if (translateX.value < maxTranslateX || translateX.value > 0) {
        const toValue = translateX.value > 0 ? 0 : maxTranslateX;

        translateX.value = withTiming(
          toValue,
          {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          },
          onFinish,
        );
      } else {
        translateX.value = withDecay(
          {
            velocity: event.velocityX,
            clamp: [maxTranslateX, 0],
          },
          onFinish,
        );
      }
    })
    .onFinalize(() => {
      // onEnd handles all seeking now; onFinalize just ensures cleanup
      if (!isAnimating.value) {
        scheduleOnRN(setIsScrubbing, false);
      }
    });

  // Consolidate all translateX-dependent calculations into one derived value
  const animatedValues = useDerivedValue(() => {
    const x = translateX.value;

    // Scrubber transform
    const scrubberTranslateX =
      x < -HALF_WIDTH
        ? (HALF_WIDTH + x) % (SPACING * 12) // end or middle
        : HALF_WIDTH + x; // beginning

    // Mask width
    let maskWidth = WIDTH + 120;
    if (x < -HALF_WIDTH && x - HALF_WIDTH <= maxTranslateX) {
      // we're at the end
      const translate = (HALF_WIDTH + x) % (SPACING * 12);
      const diff = maxTranslateX - x;
      maskWidth = HALF_WIDTH - translate - diff;
    }

    // Marker transform
    const markerTranslateX = HALF_WIDTH + x;

    return {
      scrubberTranslateX,
      maskWidth,
      markerTranslateX,
    };
  });

  const animatedScrubberStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedValues.value.scrubberTranslateX }],
  }));

  const animatedMaskStyle = useAnimatedStyle(() => ({
    width: animatedValues.value.maskWidth,
  }));

  const animatedMarkerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedValues.value.markerTranslateX }],
  }));

  const animatedTimecodeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(timecodeOpacity.value),
  }));

  const animatedTimecodeProps = useAnimatedProps(() => {
    const total = clamp(translateXToTime(translateX.value), 0, duration);
    const hours = Math.floor(total / 3600).toString();
    const minutes = Math.floor((total % 3600) / 60).toString();
    const seconds = Math.floor((total % 3600) % 60).toString();

    if (hours === "0") {
      const value = `${minutes}:${seconds.padStart(2, "0")}`;
      return { text: value, defaultValue: value };
    } else {
      const value = `${hours}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
      return { text: value, defaultValue: value };
    }
  });

  // Show timecode when scrubbing
  useEffect(() => {
    timecodeOpacity.value = isScrubbing ? 1 : 0;
  }, [isScrubbing, timecodeOpacity]);

  useFrameCallback((frameInfo) => {
    "worklet";

    // Pause frame callback during scrubbing or user seek animations
    if (!playing || isScrubbing || isAnimatingUserSeek.value) {
      lastTimestamp.value = 0;
      return;
    }

    if (lastTimestamp.value > 0) {
      const deltaSeconds = (frameInfo.timestamp - lastTimestamp.value) / 1000;

      // Advance animation based on playback rate
      translateX.value -= deltaSeconds * playbackRate * FACTOR;

      // Clamp to valid range
      translateX.value = clamp(translateX.value, maxTranslateX, 0);
    }

    lastTimestamp.value = frameInfo.timestamp;
  });

  // Animate to new position when a seek is applied from outside the scrubber
  useEffect(() => {
    // Don't run this if there's no seek event
    if (!lastSeekTimestamp) return;

    // Don't run if the seek wasn't from an external source
    if (lastSeekSource === SeekSource.SCRUBBER) return;

    // Don't animate while scrubbing (user is controlling the position)
    if (isScrubbing) return;

    const animateToNewPosition = async () => {
      try {
        const { position } = await Player.getProgress();
        scheduleOnUI(() => {
          "worklet";
          isAnimatingUserSeek.value = true;
          translateX.value = withTiming(
            timeToTranslateX(position),
            {
              duration: 400,
              easing: Easing.out(Easing.exp),
            },
            (finished) => {
              if (finished) {
                isAnimatingUserSeek.value = false;
              }
            },
          );
        });
      } catch (e) {
        // Player might not be ready, ignore
        console.warn(
          "[Scrubber] Error getting progress for seek animation:",
          e,
        );
      }
    };

    animateToNewPosition();
  }, [
    isScrubbing,
    translateX,
    isAnimatingUserSeek,
    lastSeekTimestamp,
    lastSeekSource,
  ]);

  // Periodic drift correction - check every 2 seconds without causing re-renders
  // Only runs while playing and not scrubbing
  useEffect(() => {
    // Don't run drift correction while scrubbing or paused
    if (isScrubbing || !playing) return;

    const checkDrift = async () => {
      if (isAnimatingUserSeek.value) return;

      try {
        const { position } = await Player.getProgress();
        const animatedPos = translateXToTime(translateX.value);
        const drift = Math.abs(animatedPos - position);

        // Snap if drifted more than 500ms
        if (drift > 0.5) {
          console.debug(
            `[Scrubber] drift detected: ${drift.toFixed(
              2,
            )}s, correcting animation position.`,
          );
          translateX.value = timeToTranslateX(position);
        }
      } catch {
        // TrackPlayer not ready, ignore
      }
    };

    // Check immediately on mount/state change
    checkDrift();

    // Then check periodically (every 2 seconds is plenty for drift correction)
    const intervalId = setInterval(checkDrift, DRIFT_CORRECTION_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isScrubbing, playing, translateX, isAnimatingUserSeek]);

  return (
    <GestureDetector gesture={panGestureHandler}>
      <Animated.View style={styles.container}>
        <AnimatedTextInput
          animatedProps={animatedTimecodeProps}
          style={[styles.timecode, animatedTimecodeStyle]}
          editable={false}
        />
        <Svg style={styles.indicator} height="8" width="8" viewBox="0 0 8 8">
          <Path
            d="m 0.17 0 c -1 -0 2.83 8 3.83 8 c 1 0 4.83 -8 3.83 -8 z"
            fill={colors.strong}
            stroke={colors.weak}
            strokeWidth="1"
          />
        </Svg>

        <Animated.View style={[styles.scrubber, animatedScrubberStyle]}>
          <Animated.View style={[styles.mask, animatedMaskStyle]}>
            <Ticks />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.markers, animatedMarkerStyle]}>
          <Markers markers={markers} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const colors = {
  accent: Colors.lime[400],
  strong: Colors.zinc[100],
  emphasized: Colors.zinc[200],
  normal: Colors.zinc[400],
  dimmed: Colors.zinc[500],
  weak: Colors.zinc[800],
};

const styles = StyleSheet.create({
  container: {
    marginTop: -10,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  timecode: {
    fontWeight: "300",
    fontSize: 16,
    padding: 0,
    marginBottom: -6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    color: colors.strong,
  },
  indicator: {
    left: HALF_WIDTH - 3.75,
    top: 4,
    zIndex: 1,
  },
  scrubber: {
    height: HEIGHT,
    width: WIDTH + 12 * SPACING,
  },
  mask: {
    height: HEIGHT,
    overflow: "hidden",
  },
  markers: {
    position: "absolute",
    bottom: 42,
    left: -2,
  },
  marker: {
    position: "absolute",
    top: -12,
  },
});
