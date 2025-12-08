import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, TextInput } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";
import {
  State,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { useShallow } from "zustand/shallow";

import { SeekSource, seekTo, usePlayer } from "@/stores/player";
import { Colors } from "@/styles";
import { EventBus } from "@/utils";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const SPACING = 10; // pixels between ticks
const FACTOR = SPACING / 5; // 5 seconds per tick

const WIDTH = Dimensions.get("window").width;
const HEIGHT = 60;
const HALF_WIDTH = WIDTH / 2;
const NUM_TICKS = Math.ceil(WIDTH / SPACING);

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
          x="0"
          y="0"
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

export function Scrubber() {
  const { state } = usePlaybackState();
  const { position: positionInput, duration } = useProgress(500);
  const { playbackRate, chapters } = usePlayer(
    useShallow(({ playbackRate, chapters }) => ({
      playbackRate,
      chapters,
    })),
  );
  const playing = state === State.Playing;
  const markers = chapters?.map((chapter) => chapter.startTime) || [];

  const translateX = useSharedValue(timeToTranslateX(positionInput));
  const [isScrubbing, setIsScrubbing] = useIsScrubbing();
  const maxTranslateX = timeToTranslateX(duration);
  const startX = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const isAnimatingUserSeek = useSharedValue(false);
  const timecodeOpacity = useSharedValue(0);
  const lastTimestamp = useSharedValue(0);

  const panGestureHandler = Gesture.Pan()
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
      const onFinish = (finished: boolean | undefined) => {
        isAnimating.value = false;

        if (finished) {
          const newPosition = translateXToTime(translateX.value);
          scheduleOnRN(seekTo, newPosition, SeekSource.SCRUBBER);
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
      if (!isAnimating.value) {
        const newPosition = translateXToTime(translateX.value);
        scheduleOnRN(seekTo, newPosition, SeekSource.SCRUBBER);
        scheduleOnRN(setIsScrubbing, false);
      }
    });

  const animatedScrubberStyle = useAnimatedStyle(() => {
    const value = translateX.value;

    if (value < -HALF_WIDTH) {
      // we're at the end or in the middle somewhere
      return {
        transform: [{ translateX: (HALF_WIDTH + value) % (SPACING * 12) }],
      };
    } else {
      // we're at the beginning
      return {
        transform: [{ translateX: HALF_WIDTH + value }],
      };
    }
  });

  const animatedMaskStyle = useAnimatedStyle(() => {
    const value = translateX.value;

    if (value < -HALF_WIDTH && value - HALF_WIDTH <= maxTranslateX) {
      // we're at the end
      const translate = (HALF_WIDTH + value) % (SPACING * 12);
      const diff = maxTranslateX - value;
      const width = HALF_WIDTH - translate - diff;
      return {
        width: width,
      };
    } else {
      // we're at the beginning or in the middle somewhere
      return {
        width: WIDTH + 120,
      };
    }
  });

  const animatedMarkerStyle = useAnimatedStyle(() => {
    const value = translateX.value;

    return { transform: [{ translateX: HALF_WIDTH + value }] };
  });

  const animatedTimecodeStyle = useAnimatedStyle(() => {
    return { opacity: withTiming(timecodeOpacity.value) };
  });

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

  // Listen to seekApplied events to animate user-initiated seeks
  useEffect(() => {
    const handleSeekApplied = (payload: {
      position: number;
      userInitiated: boolean;
      source: string;
    }) => {
      // Animate for user seeks (button/chapter/remote) and pause rewind, but not scrubber
      if (
        (payload.userInitiated || payload.source === SeekSource.PAUSE) &&
        payload.source !== SeekSource.SCRUBBER &&
        !isScrubbing
      ) {
        scheduleOnUI(() => {
          "worklet";
          isAnimatingUserSeek.value = true;
          translateX.value = withTiming(
            timeToTranslateX(payload.position),
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
      }
    };

    EventBus.on("seekApplied", handleSeekApplied);
    return () => {
      EventBus.off("seekApplied", handleSeekApplied);
    };
  }, [isScrubbing, translateX, isAnimatingUserSeek]);

  // Sync to position when it changes (drift correction on JS thread, not every frame)
  useEffect(() => {
    if (isScrubbing || isAnimatingUserSeek.value) return;

    const animatedPos = translateXToTime(translateX.value);
    const drift = Math.abs(animatedPos - positionInput);

    // Snap if drifted more than 500ms
    // Note: When paused, position updates from seeks will trigger this
    if (drift > 0.5) {
      translateX.value = timeToTranslateX(positionInput);
    }
  }, [positionInput, isScrubbing, translateX, isAnimatingUserSeek]);

  return (
    <GestureDetector gesture={panGestureHandler}>
      <Animated.View>
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
}

const colors = {
  accent: Colors.lime[400],
  strong: Colors.zinc[100],
  emphasized: Colors.zinc[200],
  normal: Colors.zinc[400],
  dimmed: Colors.zinc[500],
  weak: Colors.zinc[800],
};

const styles = StyleSheet.create({
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
