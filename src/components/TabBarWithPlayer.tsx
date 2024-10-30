import IconButton from "@/src/components/IconButton";
import PlayButton from "@/src/components/PlayButton";
import PlayerButtons from "@/src/components/PlayerButtons";
import PlayerProgressBar from "@/src/components/PlayerProgressBar";
import PlayerScrubber from "@/src/components/PlayerScrubber";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import TitleAuthorsNarrators from "@/src/components/TitleAuthorNarrator";
import useBackHandler from "@/src/hooks/use.back.handler";
import { useMediaDetails } from "@/src/hooks/use.media.details";
import { useScreenStore } from "@/src/stores/screen";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useProgress } from "react-native-track-player";
import colors from "tailwindcss/colors";

export default function TabBarWithPlayer({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { mediaId, lastPlayerExpandRequest, expandPlayerHandled } =
    useTrackPlayerStore((state) => state);
  const { media } = useMediaDetails(mediaId);
  const [expanded, setExpanded] = useState(true);
  const expansion = useSharedValue(1.0);
  const { screenHeight, screenWidth } = useScreenStore((state) => state);
  const whereItWas = useSharedValue(0);
  const onPanEndAction = useSharedValue<"none" | "expand" | "collapse">("none");

  const expandLocal = useCallback(() => {
    "worklet";
    expansion.value = withTiming(
      1.0,
      { duration: 400, easing: Easing.out(Easing.exp) },
      () => runOnJS(setExpanded)(true),
    );
  }, [expansion]);

  const collapseLocal = () => {
    "worklet";
    expansion.value = withTiming(
      0.0,
      { duration: 400, easing: Easing.out(Easing.exp) },
      () => runOnJS(setExpanded)(false),
    );
  };

  useEffect(() => {
    if (!expanded && lastPlayerExpandRequest) {
      expandLocal();
    }
    expandPlayerHandled();
  }, [expandLocal, expanded, lastPlayerExpandRequest, expandPlayerHandled]);

  const tabBarHeight = 50 + insets.bottom;
  const playerHeight = 70;
  const eightyPercentScreenWidth = screenWidth * 0.8;
  const tenPercentScreenWidth = screenWidth * 0.1;
  const miniControlsWidth = screenWidth - playerHeight;

  const debugBackgrounds = false;
  const debugBackground = (background: any) => {
    return debugBackgrounds ? background : undefined;
  };

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      whereItWas.value = expansion.value;
    })
    .onUpdate((e) => {
      expansion.value = Math.min(
        1.0,
        Math.max(
          0.0,
          whereItWas.value +
            e.translationY / -(screenHeight - tabBarHeight - playerHeight),
        ),
      );

      if (expansion.value > 0.85) onPanEndAction.value = "expand";
      if (expansion.value <= 0.15) onPanEndAction.value = "collapse";
      if (e.velocityY < -300) onPanEndAction.value = "expand";
      if (e.velocityY > 300) onPanEndAction.value = "collapse";
    })
    .onEnd((e) => {
      if (onPanEndAction.value === "expand") {
        expandLocal();
      } else if (onPanEndAction.value === "collapse") {
        collapseLocal();
      }
    });

  const gestures = Gesture.Race(panGesture);

  useBackHandler(() => {
    if (expanded) {
      collapseLocal();
      return true;
    }
    return false;
  });

  const tabBarStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(expansion.value, [0, 1], [0, tabBarHeight]),
        },
      ],
    };
  });

  const playerStyle = useAnimatedStyle(() => {
    const interpolatedHeight = interpolate(
      expansion.value,
      [0, 1],
      [playerHeight, screenHeight],
    );

    const interpolatedBottom = interpolate(
      expansion.value,
      [0, 1],
      [tabBarHeight, 0],
    );

    return {
      height: interpolatedHeight,
      bottom: interpolatedBottom,
      paddingTop: interpolate(expansion.value, [0, 1], [0, insets.top]),
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expansion.value, [0, 1], [0, 0.95]),
    };
  });

  const leftGutterStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(
        expansion.value,
        [0, 0.75],
        [0, tenPercentScreenWidth],
        Extrapolation.CLAMP,
      ),
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        expansion.value,
        [0, 1],
        [playerHeight, eightyPercentScreenWidth],
      ),
      width: interpolate(
        expansion.value,
        [0, 1],
        [playerHeight, eightyPercentScreenWidth],
      ),
      padding: interpolate(expansion.value, [0, 1], [8, 0]),
    };
  });

  const miniControlsStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(
        expansion.value,
        [0, 1],
        [miniControlsWidth, tenPercentScreenWidth],
      ),
      opacity: interpolate(
        expansion.value,
        [0, 0.25],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  const controlsStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        expansion.value,
        [0.75, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const topActionBarStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(expansion.value, [0, 0.75], [0, 64]),
      opacity: interpolate(
        expansion.value,
        [0.75, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const infoStyle = useAnimatedStyle(() => {
    return {
      paddingTop: interpolate(expansion.value, [0.75, 1], [32, 8]),
      opacity: interpolate(
        expansion.value,
        [0.75, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  if (!media) {
    return (
      <BottomTabBar
        style={{ height: tabBarHeight }}
        {...{ state, descriptors, navigation, insets }}
      />
    );
  }

  return (
    <>
      <TrackPlayerProgressSubscriber />
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
          backgroundColor: colors.zinc[900],
          height: tabBarHeight + playerHeight,
        }}
      >
        <GestureDetector gesture={gestures}>
          <Animated.View
            style={[
              {
                display: "flex",
                width: "100%",
                position: "absolute",
                backgroundColor: colors.zinc[900],
                borderColor: colors.zinc[600],
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              playerStyle,
            ]}
          >
            <Animated.View
              style={[
                {
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "hidden",
                  paddingHorizontal: 16,
                  backgroundColor: debugBackground(colors.emerald[900]),
                },
                topActionBarStyle,
              ]}
            >
              <IconButton
                size={24}
                icon="chevron-down"
                color={colors.zinc[100]}
                onPress={() => collapseLocal()}
              />

              {/* <IconButton
                size={24}
                icon="ellipsis-vertical"
                color={colors.zinc[100]}
                onPress={() => console.log("TODO: context menu")}
              /> */}
            </Animated.View>
            <View
              style={{
                display: "flex",
                flexDirection: "row",
              }}
            >
              <Animated.View
                style={[
                  {
                    backgroundColor: debugBackground(colors.cyan[900]),
                  },
                  leftGutterStyle,
                ]}
              ></Animated.View>
              <Animated.View
                style={[
                  {
                    alignSelf: "center",
                    overflow: "hidden",
                    backgroundColor: debugBackground(colors.green[900]),
                  },
                  imageStyle,
                ]}
              >
                <Pressable
                  onPress={() => {
                    if (expansion.value === 0.0) {
                      expandLocal();
                    } else {
                      collapseLocal();
                      setTimeout(() => {
                        router.navigate({
                          pathname: "/media/[id]",
                          params: { id: media.id, title: media.book.title },
                        });
                      }, 400);
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
              <Animated.View
                style={[
                  {
                    height: playerHeight,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: 8,
                    backgroundColor: debugBackground(colors.red[900]),
                  },
                  miniControlsStyle,
                ]}
              >
                <View className="flex-1">
                  <Pressable onPress={() => expandLocal()}>
                    <TitleAuthorsNarrators
                      baseFontSize={14}
                      title={media.book.title}
                      authors={media.book.bookAuthors.map(
                        (ba) => ba.author.name,
                      )}
                      narrators={media.mediaNarrators.map(
                        (mn) => mn.narrator.name,
                      )}
                    />
                  </Pressable>
                </View>
                <View style={{ pointerEvents: expanded ? "none" : "auto" }}>
                  <PlayButton size={32} color={colors.zinc[100]} />
                </View>
              </Animated.View>
            </View>
            <Animated.View
              style={[
                {
                  display: "flex",
                  flexDirection: "row",
                },
                infoStyle,
              ]}
            >
              <View style={{ width: "10%" }}></View>
              <View style={{ width: "80%" }}>
                <TouchableOpacity
                  onPress={() => {
                    collapseLocal();
                    setTimeout(() => {
                      router.navigate({
                        pathname: "/media/[id]",
                        params: { id: media.id, title: media.book.title },
                      });
                    }, 400);
                  }}
                >
                  <TitleAuthorsNarrators
                    baseFontSize={18}
                    titleWeight={700}
                    title={media.book.title}
                    authors={media.book.bookAuthors.map((ba) => ba.author.name)}
                    narrators={media.mediaNarrators.map(
                      (mn) => mn.narrator.name,
                    )}
                  />
                </TouchableOpacity>
              </View>
              <View style={{ width: "10%" }}></View>
            </Animated.View>
            <Animated.View
              style={[
                {
                  width: "100%",
                  flexGrow: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  paddingBottom: insets.bottom,
                  backgroundColor: debugBackground(colors.blue[900]),
                },
                controlsStyle,
              ]}
            >
              <View
                style={{
                  paddingHorizontal: tenPercentScreenWidth,
                  paddingTop: 16,
                }}
              >
                <PlayerProgressBar />
              </View>
              <PlayerButtons />
              <PlayerScrubber />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <Animated.View style={[{ height: tabBarHeight }, tabBarStyle]}>
          <BottomTabBar
            style={{ height: tabBarHeight }}
            {...{ state, descriptors, navigation, insets }}
          />
        </Animated.View>
      </View>
    </>
  );
}

function TrackPlayerProgressSubscriber() {
  const { playbackRate, updateProgress } = useTrackPlayerStore(
    (state) => state,
  );
  const { position, duration } = useProgress(1000 / playbackRate);
  useEffect(() => {
    updateProgress(position, duration);
  }, [duration, position, updateProgress]);
  return null;
}
