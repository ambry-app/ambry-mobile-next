import { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useShallow } from "zustand/shallow";

import { BlurredImage } from "@/components/BlurredImage";
import { BookDetailsText } from "@/components/BookDetailsText";
import { IconButton } from "@/components/IconButton";
import { Loading } from "@/components/Loading";
import { PlayButton } from "@/components/PlayButton";
import { PlayerContextMenu } from "@/components/PlayerContextMenu";
import { PlayerProgressBar } from "@/components/PlayerProgressBar";
import { Scrubber } from "@/components/Scrubber";
import { ThumbnailImage } from "@/components/ThumbnailImage";
import {
  PLAYER_EXPAND_ANIMATION_DURATION,
  PLAYER_HEIGHT,
  TAB_BAR_BASE_HEIGHT,
} from "@/constants";
import { getMedia, useLibraryData } from "@/services/library-service";
import {
  clearPendingExpand,
  setPlayerExpandedState,
  usePlayerUIState,
} from "@/stores/player-ui-state";
import { useScreen } from "@/stores/screen";
import { useSeekUIState } from "@/stores/seek-ui-state";
import { LoadedPlaythrough, useTrackPlayer } from "@/stores/track-player";
import { Colors, decorative, surface } from "@/styles/colors";
import { Session } from "@/types/session";
import { useBackHandler } from "@/utils/hooks";

import { TabBarTabs } from "./tab-bar/TabBarTabs";
import { ChapterControls } from "./tab-bar-with-player/ChapterControls";
import { PlaybackControls } from "./tab-bar-with-player/PlaybackControls";
import { PlayerSettingButtons } from "./tab-bar-with-player/PlayerSettingButtons";

const MINI_PROGRESS_BAR_HEIGHT = 2;
const TOP_ACTION_BAR_HEIGHT = 36;
// Visual size of the artwork when collapsed, inset within PLAYER_HEIGHT
const COLLAPSED_ARTWORK_INSET = 8;
const COLLAPSED_ARTWORK_SIZE = PLAYER_HEIGHT - COLLAPSED_ARTWORK_INSET * 2;

/**
 * `Easing.out(Easing.exp)`, but safe when evaluated outside `[0, 1]`.
 *
 * When one of these animations is started from a gesture callback, Reanimated
 * can evaluate its first frame with a timestamp *earlier* than the animation's
 * recorded start time, giving a progress of roughly -0.04 to -0.07 (one to two
 * frames). The stock easing is `1 - 2^(-10t)`, which is unbounded below zero:
 * at t = -0.06 it returns -0.53 rather than ~0. That flips the sign of the
 * interpolation, so a collapse briefly overshoots *past* fully expanded before
 * settling - visible as a one or two frame flash of the expanded player at the
 * moment you lift your finger.
 *
 * Clamping the input makes negative progress a no-op (the value simply stays
 * where it started) and keeps the curve otherwise identical. Landing exactly on
 * 1 at t = 1 is a small bonus: the stock easing tops out at 0.99902, so
 * animations never quite reached their target.
 */
function clamp01(value: number) {
  "worklet";
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeOutExp(t: number) {
  "worklet";
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(2, -10 * t);
}

// Memoized mini progress bar - subscribes to position/duration/seekPosition
const MiniProgressBar = memo(function MiniProgressBar({
  expansion,
  bottom,
}: {
  expansion: SharedValue<number>;
  bottom: number;
}) {
  const seekPosition = useSeekUIState((state) => state.seekPosition);
  const progress = useTrackPlayer((state) => state.progress);

  // Use seekPosition if available (during seek accumulation), otherwise use position
  const displayPosition = seekPosition ?? progress.position;
  const progressPercent =
    progress.duration > 0 ? (displayPosition / progress.duration) * 100 : 0;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        expansion.value,
        [0, 0.25],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom,
          left: 0,
          right: 0,
          height: MINI_PROGRESS_BAR_HEIGHT,
          backgroundColor: decorative.track,
          zIndex: 10,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          height: MINI_PROGRESS_BAR_HEIGHT,
          width: `${progressPercent}%`,
          backgroundColor: Colors.lime[400],
        }}
      />
    </Animated.View>
  );
});

type CustomTabBarWithPlayerProps = {
  session: Session;
  playthrough: LoadedPlaythrough;
};

export function CustomTabBarWithPlayer(props: CustomTabBarWithPlayerProps) {
  const { session, playthrough } = props;
  const { mediaId } = playthrough;
  const insets = useSafeAreaInsets();

  const streaming = useTrackPlayer((state) => state.streaming);

  const { loadingNewMedia, expanded, pendingExpandPlayer } = usePlayerUIState(
    useShallow(({ loadingNewMedia, expanded, pendingExpandPlayer }) => ({
      loadingNewMedia,
      expanded,
      pendingExpandPlayer,
    })),
  );
  const media = useLibraryData(() => getMedia(session, mediaId), [mediaId]);

  // Initialize expansion based on current store state to stay in sync on mount/resume
  // (useSharedValue only captures the initial value on first render)
  const expansion = useSharedValue(expanded ? 1.0 : 0.0);
  const { screenHeight, screenWidth, shortScreen } = useScreen(
    (state) => state,
  );
  const whereItWas = useSharedValue(0);
  const onPanEndAction = useSharedValue<"none" | "expand" | "collapse">("none");

  // Deferred expand: mount components first, then animate
  const expand = useCallback(() => {
    // If already expanded, just ensure animation is at 1.0
    if (expanded) {
      expansion.value = withTiming(1.0, {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: easeOutExp,
      });
      return;
    }

    // setPlayerExpandedState(false);

    // Wait for React to render, then animate
    requestAnimationFrame(() => {
      expansion.value = withTiming(
        1.0,
        {
          duration: PLAYER_EXPAND_ANIMATION_DURATION,
          easing: easeOutExp,
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setPlayerExpandedState, true);
          }
        },
      );
    });
  }, [expansion, expanded]);

  // Deferred collapse: mount components first, then animate
  const collapse = useCallback(() => {
    // If already collapsed, just ensure animation is at 0.0
    if (!expanded) {
      expansion.value = withTiming(0.0, {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: easeOutExp,
      });
      return;
    }

    // setPlayerExpandedState(false);

    // Wait for React to render, then animate
    requestAnimationFrame(() => {
      expansion.value = withTiming(
        0.0,
        {
          duration: PLAYER_EXPAND_ANIMATION_DURATION,
          easing: easeOutExp,
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setPlayerExpandedState, false);
          }
        },
      );
    });
  }, [expansion, expanded]);

  // Worklet versions for use in gesture handlers
  const expandWorklet = useCallback(() => {
    "worklet";
    expansion.value = withTiming(
      1.0,
      {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: easeOutExp,
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(setPlayerExpandedState, true);
        }
      },
    );
  }, [expansion]);
  const collapseWorklet = useCallback(() => {
    "worklet";
    expansion.value = withTiming(
      0.0,
      {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: easeOutExp,
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(setPlayerExpandedState, false);
        }
      },
    );
  }, [expansion]);
  // When a remote request to expand the player comes in, handle it.
  useEffect(() => {
    if (pendingExpandPlayer) {
      expand();
      clearPendingExpand();
    }
  }, [pendingExpandPlayer, expand]);

  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const largeImageSize = shortScreen ? screenWidth * 0.6 : screenWidth * 0.8;
  const imageGutterWidth = (screenWidth - largeImageSize) / 2;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          whereItWas.value = expansion.value;
          // Must be cleared: this shared value outlives the gesture, so without
          // a reset a swipe that never crosses a threshold would settle using
          // the *previous* gesture's decision.
          onPanEndAction.value = "none";
        })
        .onUpdate((e) => {
          expansion.value = Math.min(
            1.0,
            Math.max(
              0.0,
              whereItWas.value +
                e.translationY / -(screenHeight - tabBarHeight - PLAYER_HEIGHT),
            ),
          );

          // Velocity is checked after position so that a deliberate flick
          // overrides where the finger happens to have stopped
          if (expansion.value > 0.85) onPanEndAction.value = "expand";
          if (expansion.value <= 0.15) onPanEndAction.value = "collapse";
          if (e.velocityY < -300) onPanEndAction.value = "expand";
          if (e.velocityY > 300) onPanEndAction.value = "collapse";
        })
        .onEnd(() => {
          // A slow drag that stayed between the thresholds leaves no decision,
          // so settle to whichever end is nearer rather than stopping midway
          const action =
            onPanEndAction.value === "none"
              ? expansion.value > 0.5
                ? "expand"
                : "collapse"
              : onPanEndAction.value;

          // Use worklet versions since we're already in 'both' state
          if (action === "expand") {
            expandWorklet();
          } else {
            collapseWorklet();
          }
        }),
    [
      expansion,
      whereItWas,
      onPanEndAction,
      screenHeight,
      tabBarHeight,
      expandWorklet,
      collapseWorklet,
    ],
  );

  const isScrubberAnimationSuspended = useDerivedValue(
    () => expansion.value < 0.9,
    [expansion],
  );

  // Use expanded to determine if player can be collapsed
  useBackHandler(() => {
    if (expanded) {
      collapse();
      return true;
    }
    return false;
  });

  // Consolidated animated values - compute all interpolations in one place
  const playerOpacity = useSharedValue(0.0);

  useEffect(() => {
    if (loadingNewMedia) {
      // Immediately hide old content to show loading spinner
      playerOpacity.value = 0;
    } else {
      setTimeout(() => {
        playerOpacity.value = withTiming(1.0, { duration: 200 });
      }, 200);
    }
  }, [loadingNewMedia, playerOpacity]);

  // Geometry. The player no longer animates any layout: the collapsed strip and
  // the expanded screen are each laid out statically and cross-faded, and the
  // cover art is a single element that moves between them with transforms.
  const collapsedStripHeight = PLAYER_HEIGHT + MINI_PROGRESS_BAR_HEIGHT;
  const collapsedScale = COLLAPSED_ARTWORK_SIZE / largeImageSize;

  // Where the artwork sits in each state, in container coordinates. The
  // container spans the whole screen, anchored to its bottom.
  const artworkExpandedTop = insets.top + TOP_ACTION_BAR_HEIGHT;
  const artworkExpandedLeft = imageGutterWidth;
  const artworkCollapsedTop =
    screenHeight -
    tabBarHeight -
    collapsedStripHeight +
    COLLAPSED_ARTWORK_INSET;
  const artworkCollapsedLeft = COLLAPSED_ARTWORK_INSET;

  // The elevated surface is a childless view spanning the container, squashed
  // down to the collapsed strip with scaleY. Scaling happens about the centre,
  // so translateY puts the squashed band back at the strip's position.
  const surfaceCollapsedScaleY = collapsedStripHeight / screenHeight;
  const surfaceCollapsedTranslateY =
    screenHeight / 2 - tabBarHeight - collapsedStripHeight / 2;

  // The clamp matters: every interpolate() extrapolates by default, so an
  // out-of-range value would render *past* the expanded layout rather than
  // pinning to it. It has to stay inline - `expansion.value` must appear
  // directly in each worklet, since useAnimatedStyle decides what to subscribe
  // to by scanning its own closure. Hiding the read behind a helper leaves the
  // style subscribed to nothing, so it only updates on re-render.

  const tabBarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          clamp01(expansion.value),
          [0, 1],
          [0, tabBarHeight],
        ),
      },
    ],
  }));

  const surfaceStyle = useAnimatedStyle(() => {
    const e = clamp01(expansion.value);
    return {
      transform: [
        {
          translateY: interpolate(e, [0, 1], [surfaceCollapsedTranslateY, 0]),
        },
        { scaleY: interpolate(e, [0, 1], [surfaceCollapsedScaleY, 1]) },
      ],
    };
  });

  const playerStyle = useAnimatedStyle(() => ({
    opacity: playerOpacity.value,
  }));

  const playerLoadingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(playerOpacity.value, [0, 1], [1, 0]),
  }));

  const playerBackgroundStyle = useAnimatedStyle(() => ({
    opacity: clamp01(expansion.value) * playerOpacity.value,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: clamp01(expansion.value),
  }));

  const miniTreeStyle = useAnimatedStyle(() => {
    const e = clamp01(expansion.value);
    return {
      opacity: interpolate(e, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(e, [0, 1], [0, PLAYER_HEIGHT]) }],
    };
  });

  // Translated by exactly the artwork's travel, so the spacer the tree reserves
  // for the cover stays in register with the real cover throughout - the title
  // and controls keep sitting the right distance below it. Moving with a
  // transform costs nothing; it was animating *layout* that was expensive.
  const expandedTreeStyle = useAnimatedStyle(() => {
    const e = clamp01(expansion.value);
    return {
      opacity: interpolate(e, [0.5, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(
            e,
            [0, 1],
            [artworkCollapsedTop - artworkExpandedTop, 0],
          ),
        },
      ],
    };
  });

  // Artwork position. The outer view only translates; scaling lives on the
  // inner view so the two transforms cannot interfere with each other.
  const artworkPositionStyle = useAnimatedStyle(() => {
    const e = clamp01(expansion.value);
    return {
      transform: [
        {
          translateX: interpolate(
            e,
            [0, 1],
            [artworkCollapsedLeft - artworkExpandedLeft, 0],
          ),
        },
        {
          translateY: interpolate(
            e,
            [0, 1],
            [artworkCollapsedTop - artworkExpandedTop, 0],
          ),
        },
      ],
    };
  });

  // Inner image wrapper always laid out at full size, scaled with a transform.
  // Keeping the *layout* size fixed is what makes expo-image decode at full
  // resolution: it decodes to the view size, so animating that size would bake
  // in whichever resolution the player happened to mount at. The paired
  // translate shifts the scale origin to the top-left corner.
  const imageScaleStyle = useAnimatedStyle(() => {
    const e = clamp01(expansion.value);
    const translate = interpolate(
      e,
      [0, 1],
      [(-largeImageSize * (1 - collapsedScale)) / 2, 0],
    );
    return {
      // Larger at full size so it looks correct once scaled down
      borderRadius: interpolate(e, [0, 1], [6 / collapsedScale, 6]),
      transform: [
        { translateX: translate },
        { translateY: translate },
        { scale: interpolate(e, [0, 1], [collapsedScale, 1]) },
      ],
    };
  });

  const artworkSmallStyle = useAnimatedStyle(() => ({
    // Handed over early: the 256px source is good to roughly 85pt on a 3x
    // screen, which the artwork passes at about e = 0.12. Fading it out later
    // means blending a softened copy over the sharp one, which visibly dulls
    // high-contrast detail such as white lettering.
    opacity: interpolate(
      clamp01(expansion.value),
      [0.05, 0.15],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!media) {
    return <TabBarTabs height={tabBarHeight} paddingBottom={insets.bottom} />;
  }

  return (
    <>
      <Animated.View
        style={[
          {
            position: "absolute",
            height: "100%",
            width: "100%",
            backgroundColor: "black",
            pointerEvents: "none",
          },
          backgroundStyle,
        ]}
      />
      <View
        style={{
          display: "flex",
          justifyContent: "flex-end",
          backgroundColor: surface.elevated,
          height: tabBarHeight + PLAYER_HEIGHT,
        }}
      >
        {/* Container spans the screen and never changes size. box-none so the
            collapsed player does not swallow touches meant for the screen
            behind it - only the surface and the interactive leaves take them. */}
        {/* The detector wraps the container so it is an *ancestor* of the whole
            player. RNGH then sees touches landing on the inner pressables too
            and can compete with them - pan wins on movement, tap on tap. As a
            sibling underneath, it would only get whatever fell through the
            gaps between them. */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: screenHeight,
            }}
          >
            {/* Elevated surface. Childless, so squashing it with scaleY is free. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: screenHeight,
                  backgroundColor: surface.elevated,
                },
                surfaceStyle,
              ]}
            />

            {/* Blurred backdrop - always mounted for a smooth fade */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "black",
                },
                playerBackgroundStyle,
              ]}
            >
              <BlurredImage
                style={{ width: "100%", height: "100%", opacity: 0.125 }}
                thumbnails={media.thumbnails}
                downloadedThumbnails={media.download?.thumbnails}
                size="extraSmall"
              />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
                playerLoadingStyle,
              ]}
            >
              <Loading />
            </Animated.View>

            <Animated.View
              pointerEvents="box-none"
              style={[StyleSheet.absoluteFill, playerStyle]}
            >
              {/* Expanded tree - statically laid out for the expanded state */}
              <Animated.View
                pointerEvents={expanded ? "box-none" : "none"}
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    paddingTop: insets.top,
                  },
                  expandedTreeStyle,
                ]}
              >
                <View
                  style={{
                    height: TOP_ACTION_BAR_HEIGHT,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    paddingHorizontal: 16,
                  }}
                >
                  <IconButton
                    size={24}
                    icon="chevron-down"
                    color={Colors.zinc[100]}
                    onPress={() => collapse()}
                  />

                  {streaming !== undefined && (
                    <View
                      style={{
                        alignSelf: "flex-end",
                        paddingBottom: 4,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FontAwesome6
                        size={12}
                        name={streaming ? "cloud-arrow-down" : "download"}
                        color={Colors.zinc[700]}
                      />
                      <Text style={{ color: Colors.zinc[700] }}>
                        {streaming ? "streaming" : "downloaded"}
                      </Text>
                    </View>
                  )}

                  <PlayerContextMenu
                    session={session}
                    playthrough={playthrough}
                    bookTitle={media.book.title}
                    authors={media.book.authors}
                    narrators={media.narrators}
                    onCollapse={collapse}
                  />
                </View>

                {/* Reserves the space the shared artwork occupies */}
                <View style={{ height: largeImageSize }} />

                <View
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    paddingTop: 8,
                  }}
                >
                  <View style={{ width: "10%" }} />
                  <View style={{ width: "80%" }}>
                    <BookDetailsText
                      textStyle={{ textAlign: "center" }}
                      baseFontSize={16}
                      titleWeight={700}
                      title={media.book.title}
                      authors={media.book.authors.map((a) => a.name)}
                      narrators={media.narrators.map((n) => n.name)}
                    />
                  </View>
                  <View style={{ width: "10%" }} />
                </View>

                <View
                  style={{
                    display: "flex",
                    flexGrow: 1,
                    justifyContent: "space-between",
                    paddingBottom: insets.bottom,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: "10%",
                      paddingTop: 16,
                      display: "flex",
                      justifyContent: "space-evenly",
                      flexGrow: 1,
                    }}
                  >
                    <View style={{ display: "flex", gap: 16 }}>
                      <PlayerSettingButtons />
                      <PlayerProgressBar />
                    </View>
                    <View>
                      <PlaybackControls />
                      <ChapterControls />
                    </View>
                  </View>
                  <Scrubber
                    playerPanGesture={panGesture}
                    animationSuspended={isScrubberAnimationSuspended}
                  />
                </View>
              </Animated.View>

              {/* Collapsed tree - statically laid out for the mini player. Left
                padding clears the shared artwork, which overlays this row. */}
              <Animated.View
                pointerEvents={expanded ? "none" : "box-none"}
                style={[
                  {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: tabBarHeight + MINI_PROGRESS_BAR_HEIGHT,
                    height: PLAYER_HEIGHT,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: PLAYER_HEIGHT,
                  },
                  miniTreeStyle,
                ]}
              >
                <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
                  <Pressable onPress={() => expand()}>
                    <BookDetailsText
                      baseFontSize={14}
                      title={media.book.title}
                      authors={media.book.authors.map((a) => a.name)}
                      narrators={media.narrators.map((n) => n.name)}
                    />
                  </Pressable>
                </View>
                <PlayButton size={32} color={Colors.zinc[100]} />
              </Animated.View>

              <MiniProgressBar expansion={expansion} bottom={tabBarHeight} />

              {/* Shared artwork: the one element that morphs between states */}
              <Animated.View
                pointerEvents="box-none"
                style={[
                  {
                    position: "absolute",
                    top: artworkExpandedTop,
                    left: artworkExpandedLeft,
                    width: largeImageSize,
                    height: largeImageSize,
                  },
                  artworkPositionStyle,
                ]}
              >
                <Pressable
                  onPress={() => {
                    if (!expanded) expand();
                  }}
                >
                  {/* Two sources are stacked rather than one being scaled across
                    the whole range. Showing the 1024px source at the collapsed
                    ~54pt means minifying it ~0.16x, which aliases badly
                    (visible as shimmer); the 256px source is close to the
                    collapsed size on a 3x screen. Stacking also avoids swapping
                    `source` on a mounted image, which would re-decode and could
                    reintroduce the wrong-resolution caching this layout exists
                    to avoid.

                    The large layer stays fully opaque and only the small one on
                    top fades. Fading both would let the placeholder background
                    through the middle of the transition: stacked layers
                    composite as (1 - top)(1 - bottom), so complementary
                    opacities leave a gap that peaks at 25% where they cross. */}
                  <Animated.View
                    style={[
                      {
                        width: largeImageSize,
                        height: largeImageSize,
                        overflow: "hidden",
                      },
                      imageScaleStyle,
                    ]}
                  >
                    <View style={StyleSheet.absoluteFill}>
                      <ThumbnailImage
                        downloadedThumbnails={media.download?.thumbnails}
                        thumbnails={media.thumbnails}
                        size="extraLarge"
                        style={{ width: "100%", height: "100%" }}
                      />
                    </View>
                    <Animated.View
                      style={[StyleSheet.absoluteFill, artworkSmallStyle]}
                    >
                      <ThumbnailImage
                        downloadedThumbnails={media.download?.thumbnails}
                        thumbnails={media.thumbnails}
                        size="medium"
                        style={{ width: "100%", height: "100%" }}
                      />
                    </Animated.View>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <Animated.View style={[{ height: tabBarHeight }, tabBarStyle]}>
          <TabBarTabs
            height={tabBarHeight}
            paddingBottom={insets.bottom}
            borderTopColor={Colors.zinc[900]}
          />
        </Animated.View>
      </View>
    </>
  );
}
