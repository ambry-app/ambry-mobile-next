import { memo, useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
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

import {
  BlurredImage,
  BookDetailsText,
  IconButton,
  Loading,
  PlayButton,
  PlayerProgressBar,
  Scrubber,
  ThumbnailImage,
} from "@/components";
import {
  PLAYER_EXPAND_ANIMATION_DURATION,
  PLAYER_HEIGHT,
  TAB_BAR_BASE_HEIGHT,
} from "@/constants";
import { getMedia } from "@/db/library";
import useBackHandler from "@/hooks/use-back-handler";
import { useLibraryData } from "@/hooks/use-library-data";
import { setPlayerRenderState, usePlayer } from "@/stores/player";
import { useScreen } from "@/stores/screen";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";
import { EventBus } from "@/utils";

import { TabBarTabs } from "./tab-bar";
import {
  ChapterControls,
  PlaybackControls,
  PlayerSettingButtons,
  SeekIndicator,
} from "./tab-bar-with-player";

// Memoized mini progress bar - subscribes to progressPercent (updates every 5s)
const MiniProgressBar = memo(function MiniProgressBar({
  expansion,
}: {
  expansion: SharedValue<number>;
}) {
  const progressPercent = usePlayer((state) => state.progressPercent);

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
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: Colors.zinc[700],
          zIndex: 10,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          height: 2,
          width: `${progressPercent}%`,
          backgroundColor: Colors.lime[400],
        }}
      />
    </Animated.View>
  );
});

type CustomTabBarWithPlayerProps = {
  session: Session;
  mediaId: string;
};

export function CustomTabBarWithPlayer(props: CustomTabBarWithPlayerProps) {
  const { session, mediaId } = props;
  const insets = useSafeAreaInsets();

  const { streaming, loadingNewMedia, shouldRenderMini, shouldRenderExpanded } =
    usePlayer(
      useShallow(
        ({
          streaming,
          loadingNewMedia,
          shouldRenderMini,
          shouldRenderExpanded,
        }) => ({
          streaming,
          loadingNewMedia,
          shouldRenderMini,
          shouldRenderExpanded,
        }),
      ),
    );
  const media = useLibraryData(() => getMedia(session, mediaId), [mediaId]);

  const expansion = useSharedValue(1.0);
  const { screenHeight, screenWidth, shortScreen } = useScreen(
    (state) => state,
  );
  const whereItWas = useSharedValue(0);
  const onPanEndAction = useSharedValue<"none" | "expand" | "collapse">("none");

  // Helper to set render state via scheduleOnRN (for use in worklets)
  const setRenderBoth = useCallback(() => {
    setPlayerRenderState(true, true);
  }, []);

  const setRenderExpanded = useCallback(() => {
    setPlayerRenderState(false, true);
  }, []);

  const setRenderCollapsed = useCallback(() => {
    setPlayerRenderState(true, false);
  }, []);

  // Deferred expand: mount components first, then animate
  const expand = useCallback(() => {
    // If already expanded, just ensure animation is at 1.0
    if (!shouldRenderMini && shouldRenderExpanded) {
      expansion.value = withTiming(1.0, {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: Easing.out(Easing.exp),
      });
      return;
    }

    // Mount both first
    setPlayerRenderState(true, true);

    // Wait for React to render, then animate
    requestAnimationFrame(() => {
      expansion.value = withTiming(
        1.0,
        {
          duration: PLAYER_EXPAND_ANIMATION_DURATION,
          easing: Easing.out(Easing.exp),
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setRenderExpanded);
          }
        },
      );
    });
  }, [expansion, shouldRenderMini, shouldRenderExpanded, setRenderExpanded]);

  // Deferred collapse: mount components first, then animate
  const collapse = useCallback(() => {
    // If already collapsed, just ensure animation is at 0.0
    if (shouldRenderMini && !shouldRenderExpanded) {
      expansion.value = withTiming(0.0, {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: Easing.out(Easing.exp),
      });
      return;
    }

    // Mount both first
    setPlayerRenderState(true, true);

    // Wait for React to render, then animate
    requestAnimationFrame(() => {
      expansion.value = withTiming(
        0.0,
        {
          duration: PLAYER_EXPAND_ANIMATION_DURATION,
          easing: Easing.out(Easing.exp),
        },
        (finished) => {
          if (finished) {
            scheduleOnRN(setRenderCollapsed);
          }
        },
      );
    });
  }, [expansion, shouldRenderMini, shouldRenderExpanded, setRenderCollapsed]);

  // Worklet versions for use in gesture handlers
  const expandWorklet = useCallback(() => {
    "worklet";
    expansion.value = withTiming(
      1.0,
      {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: Easing.out(Easing.exp),
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(setRenderExpanded);
        }
      },
    );
  }, [expansion, setRenderExpanded]);

  const collapseWorklet = useCallback(() => {
    "worklet";
    expansion.value = withTiming(
      0.0,
      {
        duration: PLAYER_EXPAND_ANIMATION_DURATION,
        easing: Easing.out(Easing.exp),
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(setRenderCollapsed);
        }
      },
    );
  }, [expansion, setRenderCollapsed]);

  useEffect(() => {
    const handler = () => {
      expand();
    };
    EventBus.on("expandPlayer", handler);
    return () => {
      EventBus.off("expandPlayer", handler);
    };
  }, [expand]);

  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const largeImageSize = shortScreen ? screenWidth * 0.6 : screenWidth * 0.8;
  const imageGutterWidth = (screenWidth - largeImageSize) / 2;

  const miniControlsWidth = screenWidth - PLAYER_HEIGHT;

  const debugBackgrounds = false;
  const debugBackground = (background: any) => {
    return debugBackgrounds ? background : undefined;
  };

  const panGesture = Gesture.Pan()
    .onTouchesDown(() => {
      // Pre-mount components early, before pan visually starts
      // This gives React time to render before the gesture animation begins
      scheduleOnRN(setRenderBoth);
    })
    .onStart(() => {
      whereItWas.value = expansion.value;
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

      if (expansion.value > 0.85) onPanEndAction.value = "expand";
      if (expansion.value <= 0.15) onPanEndAction.value = "collapse";
      if (e.velocityY < -300) onPanEndAction.value = "expand";
      if (e.velocityY > 300) onPanEndAction.value = "collapse";
    })
    .onEnd(() => {
      // Use worklet versions since we're already in 'both' state
      if (onPanEndAction.value === "expand") {
        expandWorklet();
      } else if (onPanEndAction.value === "collapse") {
        collapseWorklet();
      }
    });

  const gestures = Gesture.Race(panGesture);

  // Use shouldRenderExpanded to determine if player can be collapsed
  useBackHandler(() => {
    if (shouldRenderExpanded && expansion.value > 0.5) {
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

  // Pre-compute all animated values in a single derived value to reduce worklet overhead
  const animatedValues = useDerivedValue(() => {
    const e = expansion.value;
    const po = playerOpacity.value;

    return {
      // Tab bar
      tabBarTranslateY: interpolate(e, [0, 1], [0, tabBarHeight]),
      // Player container
      playerHeight: interpolate(e, [0, 1], [PLAYER_HEIGHT, screenHeight]),
      playerBottom: interpolate(e, [0, 1], [tabBarHeight, 0]),
      playerPaddingTop: interpolate(e, [0, 1], [0, insets.top]),
      // Opacities
      playerOpacity: po,
      playerLoadingOpacity: interpolate(po, [0, 1], [1, 0]),
      playerBackgroundOpacity: e * po,
      backgroundOpacity: e,
      // Image area
      leftGutterWidth: interpolate(
        e,
        [0, 0.75],
        [0, imageGutterWidth],
        Extrapolation.CLAMP,
      ),
      imageSize: interpolate(e, [0, 1], [PLAYER_HEIGHT, largeImageSize]),
      imagePadding: interpolate(e, [0, 1], [8, 0]),
      // Mini controls (fade out early)
      miniControlsWidth: interpolate(
        e,
        [0, 1],
        [miniControlsWidth, imageGutterWidth],
      ),
      miniControlsOpacity: interpolate(
        e,
        [0, 0.25],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      // Expanded controls (fade in late)
      controlsTranslateY: interpolate(e, [0, 1], [256, 0]),
      controlsMarginBottom: interpolate(e, [0, 1], [-512, 0]),
      controlsOpacity: interpolate(e, [0.75, 1], [0, 1], Extrapolation.CLAMP),
      // Top action bar
      topActionBarHeight: interpolate(e, [0, 0.75], [0, 36]),
      topActionBarOpacity: interpolate(
        e,
        [0.75, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      // Info section
      infoPaddingTop: interpolate(e, [0.75, 1], [64, 8]),
      infoOpacity: interpolate(e, [0.75, 1], [0, 1], Extrapolation.CLAMP),
    };
  });

  // Individual animated styles that read from the consolidated values
  const tabBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: animatedValues.value.tabBarTranslateY }],
  }));

  const playerContainerStyle = useAnimatedStyle(() => ({
    height: animatedValues.value.playerHeight,
    bottom: animatedValues.value.playerBottom,
    paddingTop: animatedValues.value.playerPaddingTop,
  }));

  const playerStyle = useAnimatedStyle(() => ({
    opacity: animatedValues.value.playerOpacity,
  }));

  const playerLoadingStyle = useAnimatedStyle(() => ({
    opacity: animatedValues.value.playerLoadingOpacity,
  }));

  const playerBackgroundStyle = useAnimatedStyle(() => ({
    opacity: animatedValues.value.playerBackgroundOpacity,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: animatedValues.value.backgroundOpacity,
  }));

  const leftGutterStyle = useAnimatedStyle(() => ({
    width: animatedValues.value.leftGutterWidth,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    height: animatedValues.value.imageSize,
    width: animatedValues.value.imageSize,
    padding: animatedValues.value.imagePadding,
  }));

  const miniControlsStyle = useAnimatedStyle(() => ({
    width: animatedValues.value.miniControlsWidth,
    opacity: animatedValues.value.miniControlsOpacity,
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: animatedValues.value.controlsTranslateY }],
    marginBottom: animatedValues.value.controlsMarginBottom,
    opacity: animatedValues.value.controlsOpacity,
  }));

  const topActionBarStyle = useAnimatedStyle(() => ({
    height: animatedValues.value.topActionBarHeight,
    opacity: animatedValues.value.topActionBarOpacity,
  }));

  const infoStyle = useAnimatedStyle(() => ({
    paddingTop: animatedValues.value.infoPaddingTop,
    opacity: animatedValues.value.infoOpacity,
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
          backgroundColor: Colors.zinc[900],
          height: tabBarHeight + PLAYER_HEIGHT,
        }}
      >
        <GestureDetector gesture={gestures}>
          <Animated.View
            style={[
              {
                display: "flex",
                width: "100%",
                position: "absolute",
                backgroundColor: Colors.zinc[900],
              },
              playerContainerStyle,
            ]}
          >
            {/* Mini progress bar - only when not fully expanded */}
            {shouldRenderMini && <MiniProgressBar expansion={expansion} />}

            {/* Blurred background - always render for smooth animation */}
            <Animated.View
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
                style={{
                  width: "100%",
                  height: "100%",
                  opacity: 0.125,
                }}
                thumbnails={media.thumbnails}
                downloadedThumbnails={media.download?.thumbnails}
                size="extraSmall"
              />
            </Animated.View>

            {/* Loading spinner - always render */}
            <Animated.View
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
              style={[{ display: "flex", height: "100%" }, playerStyle]}
            >
              {/* Top action bar - only when not fully collapsed */}
              {shouldRenderExpanded && (
                <Animated.View
                  style={[
                    {
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      overflow: "hidden",
                      paddingHorizontal: 16,
                      backgroundColor: debugBackground("emerald"),
                    },
                    topActionBarStyle,
                  ]}
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

                  <IconButton
                    size={24}
                    icon="ellipsis-vertical"
                    color={Colors.zinc[100]}
                    onPress={() => console.debug("TODO: context menu")}
                    style={{ opacity: 0 }}
                  />
                </Animated.View>
              )}

              {/* Image row with mini controls */}
              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                }}
              >
                <Animated.View
                  style={[
                    {
                      backgroundColor: debugBackground("cyan"),
                    },
                    leftGutterStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    {
                      alignSelf: "center",
                      overflow: "hidden",
                      backgroundColor: debugBackground("green"),
                    },
                    imageStyle,
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      if (shouldRenderMini) {
                        expand();
                      }
                    }}
                  >
                    <ThumbnailImage
                      downloadedThumbnails={media.download?.thumbnails}
                      thumbnails={media.thumbnails}
                      size="extraLarge"
                      style={{
                        width: "100%",
                        aspectRatio: 1,
                        borderRadius: 6,
                      }}
                    />
                  </Pressable>
                </Animated.View>

                {/* Mini controls - only when not fully expanded */}
                {shouldRenderMini && (
                  <Animated.View
                    style={[
                      {
                        height: PLAYER_HEIGHT,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        paddingLeft: 8,
                        backgroundColor: debugBackground(Colors.red[900]),
                      },
                      miniControlsStyle,
                    ]}
                  >
                    <View
                      style={{
                        flexGrow: 1,
                        flexShrink: 1,
                        flexBasis: 0,
                      }}
                    >
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
                )}
              </View>

              {/* Expanded content - only when not fully collapsed */}
              {shouldRenderExpanded && (
                <>
                  {/* Info section with centered book details */}
                  <Animated.View
                    style={[
                      {
                        display: "flex",
                        flexDirection: "row",
                        backgroundColor: debugBackground("indigo"),
                        paddingTop: 8,
                      },
                      infoStyle,
                    ]}
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
                  </Animated.View>

                  {/* Controls section */}
                  <Animated.View
                    style={[
                      {
                        display: "flex",
                        flexGrow: 1,
                        justifyContent: "space-between",
                        paddingBottom: insets.bottom,
                        backgroundColor: debugBackground("blue"),
                      },
                      controlsStyle,
                    ]}
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
                        <SeekIndicator />
                        <PlaybackControls />
                        <ChapterControls />
                      </View>
                    </View>
                    <Scrubber />
                  </Animated.View>
                </>
              )}
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
