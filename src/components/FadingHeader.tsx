import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  clamp,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { Colors } from "@/styles/colors";
import Logo from "@assets/images/logo.svg";

export type ScrollHandler = (
  event: NativeSyntheticEvent<NativeScrollEvent>,
) => void;

// Default scroll threshold where header fades in/out
const DEFAULT_SCROLL_THRESHOLD = 300;
// Default duration of the fade animation in ms
const DEFAULT_FADE_DURATION = 200;

type UseFadingHeaderOptions = {
  scrollThreshold?: number;
  fadeDuration?: number;
};

/**
 * Hook that provides scroll-based header fade animation.
 *
 * Returns:
 * - scrollHandler: Attach to Animated.ScrollView's onScroll prop
 * - headerOpacity: Shared value for header fade (0 when above threshold, 1 below)
 *
 * Usage:
 * ```tsx
 * const { scrollHandler, headerOpacity } = useFadingHeader();
 *
 * <Stack.Screen
 *   options={{
 *     headerBackground: () => <FadingHeaderBackground headerOpacity={headerOpacity} />,
 *     headerTitle: () => <FadingHeaderTitle headerOpacity={headerOpacity} title={title} />,
 *   }}
 * />
 * <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
 *   ...
 * </Animated.ScrollView>
 * ```
 */
export function useFadingHeader(options: UseFadingHeaderOptions = {}) {
  const {
    scrollThreshold = DEFAULT_SCROLL_THRESHOLD,
    fadeDuration = DEFAULT_FADE_DURATION,
  } = options;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Derive animated opacity that fades in/out when crossing threshold
  const headerOpacity = useDerivedValue<number>(() => {
    const targetOpacity = scrollY.value >= scrollThreshold ? 1 : 0;
    return withTiming(targetOpacity, { duration: fadeDuration });
  });

  return { scrollHandler, headerOpacity };
}

type FadingHeaderBackgroundProps = {
  headerOpacity: SharedValue<number>;
  height: number;
};

/**
 * Animated header background that fades in/out based on scroll position.
 * Use with useFadingHeader() hook.
 */
export function FadingHeaderBackground({
  headerOpacity,
  height,
}: FadingHeaderBackgroundProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  return (
    <Animated.View
      style={[styles.headerBackground, { height }, animatedStyle]}
    />
  );
}

type FadingHeaderTitleProps = {
  headerOpacity: SharedValue<number>;
  title: string;
};

/**
 * Animated header title that fades in/out based on scroll position.
 * Use with useFadingHeader() hook.
 */
export function FadingHeaderTitle({
  headerOpacity,
  title,
}: FadingHeaderTitleProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
    </Animated.View>
  );
}

type SolidHeaderBackgroundProps = {
  borderOpacity: SharedValue<number>;
  height: number;
};

/**
 * Solid black header background with an animated bottom border.
 * Border fades in/out based on scroll position.
 * Use with useFadingHeader() hook (pass headerOpacity as borderOpacity).
 */
export function SolidHeaderBackground({
  borderOpacity,
  height,
}: SolidHeaderBackgroundProps) {
  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  return (
    <View style={[styles.solidHeaderBackground, { height }]}>
      <Animated.View style={[styles.headerBorder, animatedBorderStyle]} />
    </View>
  );
}

type MinimalHeaderBackgroundProps = {
  borderOpacity: SharedValue<number>;
  height: number;
};

/**
 * Minimal header that only covers the status bar area.
 * Positioned absolutely at the top - content scrolls behind it.
 * Has an animated bottom border that fades in/out based on scroll.
 * Use with useFadingHeader() hook for headerless tab screens.
 */
export function MinimalHeaderBackground({
  borderOpacity,
  height,
}: MinimalHeaderBackgroundProps) {
  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  return (
    <View
      style={[styles.minimalHeaderBackground, { height }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.headerBorder, animatedBorderStyle]} />
    </View>
  );
}

type StatusBarOverlayProps = {
  height: number;
};

/**
 * Semi-transparent overlay for the status bar area.
 * Provides contrast for status bar icons when content scrolls behind.
 * Should be rendered as the last child of a container View with position: absolute.
 */
export function StatusBarOverlay({ height }: StatusBarOverlayProps) {
  return (
    <View style={[styles.statusBarOverlay, { height }]} pointerEvents="none" />
  );
}

// Height of the collapsible header content (logo + padding)
export const HEADER_CONTENT_HEIGHT = 48;

type UseCollapsibleHeaderOptions = {
  statusBarHeight: number;
  headerContentHeight?: number;
};

/**
 * Hook for YouTube Music style collapsible header.
 *
 * Behavior:
 * - Scrolling UP: Header collapses (translates up) until fully off screen
 * - Scrolling DOWN: Header expands (translates down) until logo/search visible
 * - Happens regardless of scroll position
 *
 * Returns:
 * - scrollHandler: Attach to Animated.ScrollView/FlatList onScroll
 * - headerTranslateY: Shared value for header translation
 * - borderOpacity: Shared value for bottom border (shows when collapsed)
 */
export function useCollapsibleHeader(options: UseCollapsibleHeaderOptions) {
  const { statusBarHeight, headerContentHeight = HEADER_CONTENT_HEIGHT } =
    options;

  // Total distance to translate to fully hide header above screen
  const maxTranslate = statusBarHeight + headerContentHeight;

  const scrollY = useSharedValue(0);
  const prevScrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const delta = currentY - prevScrollY.value;

      // Only apply translation when scrolling within content (not bouncing)
      if (currentY > 0) {
        // Accumulate translation based on scroll delta
        const newTranslateY = headerTranslateY.value - delta;
        // Clamp between -maxTranslate (fully hidden) and 0 (expanded)
        headerTranslateY.value = clamp(newTranslateY, -maxTranslate, 0);
      } else {
        // At top or bouncing - ensure header is expanded
        headerTranslateY.value = withTiming(0, { duration: 150 });
      }

      prevScrollY.value = currentY;
      scrollY.value = currentY;
    },
  });

  // Content fades out as it scrolls up
  const contentOpacity = useDerivedValue<number>(() => {
    const progress = -headerTranslateY.value / maxTranslate;
    // Fade from 1 to 0 as progress goes from 0 to 1
    return 1 - progress;
  });

  // Calculate border position (clamped to status bar height)
  const borderTranslateY = useDerivedValue(() => {
    const headerBottom = headerTranslateY.value + maxTranslate;
    return Math.max(headerBottom, statusBarHeight);
  });

  // Border shows ONLY when content is scrolled under the visible header area
  const borderOpacity = useDerivedValue<number>(() => {
    // Where the content starts relative to the screen top
    // (Content has paddingTop = maxTranslate)
    const contentTop = maxTranslate - scrollY.value;

    // Check if content is visually under the border (with small epsilon)
    const isContentUnder = contentTop < borderTranslateY.value - 0.5;

    return isContentUnder
      ? withTiming(1, { duration: 150 })
      : withTiming(0, { duration: 150 });
  });

  return {
    scrollHandler,
    headerTranslateY,
    borderTranslateY,
    borderOpacity,
    contentOpacity,
    scrollY,
  };
}

type CollapsibleTabHeaderProps = {
  headerTranslateY: SharedValue<number>;
  borderTranslateY: SharedValue<number>;
  borderOpacity: SharedValue<number>;
  contentOpacity: SharedValue<number>;
  statusBarHeight: number;
  onSearchPress?: () => void;
};

/**
 * YouTube Music style collapsible header for tab screens.
 *
 * Features:
 * - Logo on left, search icon on right
 * - Collapses on scroll up (goes off screen), expands on scroll down
 * - Status bar area always visible with border when collapsed
 */
export function CollapsibleTabHeader({
  headerTranslateY,
  borderTranslateY,
  borderOpacity,
  contentOpacity,
  statusBarHeight,
  onSearchPress,
}: CollapsibleTabHeaderProps) {
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
    transform: [{ translateY: borderTranslateY.value }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View style={styles.collapsibleContainer} pointerEvents="box-none">
      {/* Status bar background - lowest layer, always visible */}
      <View
        style={[styles.statusBarBackground, { height: statusBarHeight }]}
        pointerEvents="none"
      />

      {/* Collapsible header content - scrolls OVER status bar and off screen */}
      <Animated.View
        style={[styles.collapsibleHeaderContent, animatedHeaderStyle]}
        pointerEvents="box-none"
      >
        {/* Spacer for status bar area */}
        <View style={{ height: statusBarHeight }} />
        {/* Logo and search row - fades as it scrolls up */}
        <Animated.View
          style={[styles.collapsibleHeaderInner, animatedContentStyle]}
        >
          <Logo width={100} height={22} />
          <Pressable
            onPress={onSearchPress}
            style={styles.searchButton}
            hitSlop={8}
          >
            <FontAwesome6
              name="magnifying-glass"
              size={20}
              color={Colors.zinc[100]}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Floating border that follows header but stops at status bar */}
      <Animated.View
        style={[
          styles.headerBorder,
          { top: 0, bottom: undefined },
          animatedBorderStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBackground: {
    flex: 1,
    backgroundColor: "black",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.zinc[700],
  },
  solidHeaderBackground: {
    flex: 1,
    backgroundColor: "black",
  },
  minimalHeaderBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "black",
    zIndex: 1,
  },
  headerBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.zinc[700],
  },
  headerTitle: {
    color: Colors.zinc[100],
    fontSize: 17,
    fontWeight: "600",
  },
  statusBarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  collapsibleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  statusBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "black",
    zIndex: 1,
  },
  collapsibleHeaderContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "black",
    zIndex: 2,
  },
  collapsibleHeaderInner: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  searchButton: {
    padding: 8,
  },
});
