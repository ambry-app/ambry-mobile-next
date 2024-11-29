import {
  IconButton,
  PlayButton,
  ThumbnailImage,
  TitleAuthorsNarrators,
} from "@/src/components";
import {
  ChapterControls,
  PlaybackControls,
  PlayerScrubber,
  PlayerSettingButtons,
  ProgressBar,
} from "@/src/components/Player";
import { playerHeight, tabBarBaseHeight } from "@/src/constants";
import { useMediaDetails } from "@/src/db/library";
import useBackHandler from "@/src/hooks/use.back.handler";
import { expandPlayerHandled, usePlayer } from "@/src/stores/player";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
import { useShallow } from "zustand/react/shallow";

type TabBarWithPlayerProps = BottomTabBarProps & {
  session: Session;
  mediaId: string;
};

export default function TabBarWithPlayer(props: TabBarWithPlayerProps) {
  const { state, descriptors, navigation, insets, session, mediaId } = props;
  const { lastPlayerExpandRequest, streaming } = usePlayer(
    useShallow(({ lastPlayerExpandRequest, streaming }) => ({
      lastPlayerExpandRequest,
      streaming,
    })),
  );
  const { media, opacity } = useMediaDetails(session, mediaId);
  const [expanded, setExpanded] = useState(true);
  const expansion = useSharedValue(1.0);
  const { screenHeight, screenWidth } = useScreen((state) => state);
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
  }, [expandLocal, expanded, lastPlayerExpandRequest]);

  const tabBarHeight = tabBarBaseHeight + insets.bottom;
  const shortScreen = screenHeight / screenWidth < 1.8;
  const largeImageSize = shortScreen ? screenWidth * 0.6 : screenWidth * 0.8;
  const imageGutterWidth = (screenWidth - largeImageSize) / 2;

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
    return {
      opacity: opacity.value,
      height: interpolate(
        expansion.value,
        [0, 1],
        [playerHeight, screenHeight],
      ),
      bottom: interpolate(expansion.value, [0, 1], [tabBarHeight, 0]),
      paddingTop: interpolate(expansion.value, [0, 1], [0, insets.top]),
      borderTopWidth: interpolate(
        expansion.value,
        [0, 1],
        [StyleSheet.hairlineWidth, 0],
      ),
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
        [0, imageGutterWidth],
        Extrapolation.CLAMP,
      ),
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        expansion.value,
        [0, 1],
        [playerHeight, largeImageSize],
      ),
      width: interpolate(
        expansion.value,
        [0, 1],
        [playerHeight, largeImageSize],
      ),
      padding: interpolate(expansion.value, [0, 1], [8, 0]),
    };
  });

  const miniControlsStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(
        expansion.value,
        [0, 1],
        [miniControlsWidth, imageGutterWidth],
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
      transform: [
        {
          translateY: interpolate(expansion.value, [0, 1], [256, 0]),
        },
      ],
      marginBottom: interpolate(expansion.value, [0, 1], [-512, 0]),
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
      height: interpolate(expansion.value, [0, 0.75], [0, 36]),
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
      paddingTop: interpolate(expansion.value, [0.75, 1], [64, 8]),
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
                backgroundColor: Colors.zinc[900],
                borderColor: Colors.zinc[600],
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
                  backgroundColor: debugBackground("emerald"),
                },
                topActionBarStyle,
              ]}
            >
              <IconButton
                size={24}
                icon="chevron-down"
                color={Colors.zinc[100]}
                onPress={() => collapseLocal()}
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
                onPress={() => console.log("TODO: context menu")}
                style={{ opacity: 0 }}
              />
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
                    backgroundColor: debugBackground("cyan"),
                  },
                  leftGutterStyle,
                ]}
              ></Animated.View>
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
                  <PlayButton size={32} color={Colors.zinc[100]} />
                </View>
              </Animated.View>
            </View>
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
                    baseFontSize={16}
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
                  <ProgressBar />
                </View>
                <View>
                  <PlaybackControls />
                  <ChapterControls />
                </View>
              </View>
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
