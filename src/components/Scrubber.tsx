import AnimatedText from "@/src/components/AnimatedText";
import usePrevious from "@react-hook/previous";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path, Rect } from "react-native-svg";

type Theme = {
  strong: string;
  normal: string;
  dimmed: string;
  emphasized: string;
  accent: string;
  weak: string;
};

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
  return time * -FACTOR;
}

function translateXToTime(translateX: number) {
  "worklet";
  return translateX / -FACTOR;
}

function useIsScrubbing() {
  const [isScrubbing, _setIsScrubbing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>();

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

type TicksProps = {
  theme: Theme;
};

const Ticks = memo(function Ticks({ theme }: TicksProps) {
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
              ? theme.emphasized
              : i % 6 === 0
                ? theme.normal
                : theme.dimmed
          }
          strokeWidth="1"
        />
      ))}
    </Svg>
  );
});

type MarkersProps = {
  markers: number[];
  theme: Theme;
};

const Markers = memo(function Markers({ markers, theme }: MarkersProps) {
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
          fill={theme.accent}
          stroke={theme.weak}
          strokeWidth="2"
        />
      </Svg>
    );
  });
});

type ScrubberProps = {
  position: number;
  duration: number;
  playbackRate: number;
  onChange: (newPosition: number) => void;
  markers: number[];
  theme: Theme;
};

export default function Scrubber(props: ScrubberProps) {
  const {
    position: positionInput,
    duration,
    playbackRate,
    onChange,
    markers,
    theme,
  } = props;
  // console.log('RENDERING: Scrubber')
  const translateX = useSharedValue(
    timeToTranslateX(Math.round(positionInput)),
  );
  const [isScrubbing, setIsScrubbing] = useIsScrubbing();
  const maxTranslateX = timeToTranslateX(duration);
  const previousPosition = usePrevious(positionInput);

  const startX = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  const panGestureHandler = Gesture.Pan()
    .onStart((_event) => {
      runOnJS(setIsScrubbing)(true);
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
          runOnJS(onChange)(newPosition);
          runOnJS(setIsScrubbing)(false);
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
        runOnJS(onChange)(newPosition);
        runOnJS(setIsScrubbing)(false);
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

  const timecode = useDerivedValue(() => {
    const total = clamp(translateXToTime(translateX.value), 0, duration);
    const hours = Math.floor(total / 3600).toString();
    const minutes = Math.floor((total % 3600) / 60).toString();
    const seconds = Math.floor((total % 3600) % 60).toString();

    if (hours === "0") {
      return `${minutes}:${seconds.padStart(2, "0")}`;
    } else {
      return `${hours}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
    }
  });

  useEffect(() => {
    if (!isScrubbing) {
      translateX.value = timeToTranslateX(positionInput);
      // if (Math.abs(positionInput - (previousPosition || positionInput)) > 5) {
      //   translateX.value = withTiming(timeToTranslateX(positionInput), {
      //     easing: Easing.out(Easing.exp),
      //   });
      // } else {
      //   translateX.value = withTiming(timeToTranslateX(positionInput), {
      //     duration: 1000 / playbackRate,
      //     easing: Easing.linear,
      //   });
      // }
    }
  }, [translateX, isScrubbing, positionInput, previousPosition, playbackRate]);

  return (
    <GestureDetector gesture={panGestureHandler}>
      <Animated.View>
        <AnimatedText
          text={timecode}
          style={[styles.timecode, { color: theme.strong }]}
        />
        <Svg style={styles.indicator} height="8" width="8" viewBox="0 0 8 8">
          <Path
            d="m 0.17 0 c -1 -0 2.83 8 3.83 8 c 1 0 4.83 -8 3.83 -8 z"
            fill={theme.strong}
            stroke={theme.weak}
            strokeWidth="1"
          />
        </Svg>

        <Animated.View style={[styles.scrubber, animatedScrubberStyle]}>
          <Animated.View style={[styles.mask, animatedMaskStyle]}>
            <Ticks theme={theme} />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.markers, animatedMarkerStyle]}>
          <Markers markers={markers} theme={theme} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  timecode: {
    fontWeight: "300",
    fontSize: 16,
    padding: 0,
    marginBottom: -6,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
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
