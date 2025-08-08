import {
  BlurredImage,
  BookDetailsText,
  IconButton,
  Loading,
  PlayButton,
  PlayerProgressBar,
  ThumbnailImage,
} from "@/src/components";
import { PLAYER_HEIGHT, TAB_BAR_BASE_HEIGHT } from "@/src/constants";
import { getMedia } from "@/src/db/library";
import useBackHandler from "@/src/hooks/use-back-handler";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePlayer } from "@/src/stores/player";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { EventBus } from "@/src/utils";
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
import { useShallow } from "zustand/shallow";
import {
  ChapterControls,
  PlaybackControls,
  PlayerScrubber,
  PlayerSettingButtons,
  SeekIndicator,
} from "./tab-bar-with-player";

type TabBarWithPlayerProps = BottomTabBarProps & {
  session: Session;
  mediaId: string;
};

export function TabBarWithPlayer(props: TabBarWithPlayerProps) {
  const { state, descriptors, navigation, insets, session, mediaId } = props;
  const { streaming, loadingNewMedia } = usePlayer(
    useShallow(({ streaming, loadingNewMedia }) => ({
      streaming,
      loadingNewMedia,
    })),
  );
  const media = useLibraryData(() => getMedia(session, mediaId), [mediaId]);
  const [expanded, setExpanded] = useState(true);
  const expansion = useSharedValue(1.0);
  const { screenHeight, screenWidth, shortScreen } = useScreen(
    (state) => state,
  );
  const whereItWas = useSharedValue(0);
  const onPanEndAction = useSharedValue<"none" | "expand" | "collapse">("none");

  const expand = useCallback(() => {
    "worklet";

    expansion.value = withTiming(
      1.0,
      { duration: 400, easing: Easing.out(Easing.exp) },
      () => {
        runOnJS(setExpanded)(true);
      },
    );
  }, [expansion]);

  const collapse = () => {
    "worklet";

    expansion.value = withTiming(
      0.0,
      { duration: 400, easing: Easing.out(Easing.exp) },
      () => {
        runOnJS(setExpanded)(false);
      },
    );
  };

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
    .onStart((e) => {
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
    .onEnd((e) => {
      if (onPanEndAction.value === "expand") {
        expand();
      } else if (onPanEndAction.value === "collapse") {
        collapse();
      }
    });

  const gestures = Gesture.Race(panGesture);

  useBackHandler(() => {
    if (expanded) {
      collapse();
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

  const playerContainerStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        expansion.value,
        [0, 1],
        [PLAYER_HEIGHT, screenHeight],
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

  const playerOpacity = useSharedValue(0.0);

  useEffect(() => {
    if (loadingNewMedia) {
      playerOpacity.value = withTiming(0.0, { duration: 400 });
    } else {
      setTimeout(() => {
        playerOpacity.value = withTiming(1.0, { duration: 200 });
      }, 200);
    }
  }, [loadingNewMedia, playerOpacity]);

  const playerStyle = useAnimatedStyle(() => {
    return {
      opacity: playerOpacity.value,
    };
  });

  const playerLoadingStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(playerOpacity.value, [0, 1], [1, 0]),
    };
  });

  const playerBackgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: expansion.value,
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: expansion.value,
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
        [PLAYER_HEIGHT, largeImageSize],
      ),
      width: interpolate(
        expansion.value,
        [0, 1],
        [PLAYER_HEIGHT, largeImageSize],
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
                borderColor: Colors.zinc[600],
              },
              playerContainerStyle,
            ]}
          >
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
                      if (!expanded) {
                        expand();
                      } else {
                        collapse();
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
                      collapse();
                      setTimeout(() => {
                        router.navigate({
                          pathname: "/media/[id]",
                          params: { id: media.id, title: media.book.title },
                        });
                      }, 400);
                    }}
                  >
                    <BookDetailsText
                      textStyle={{ textAlign: "center" }}
                      baseFontSize={16}
                      titleWeight={700}
                      title={media.book.title}
                      authors={media.book.authors.map((a) => a.name)}
                      narrators={media.narrators.map((n) => n.name)}
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
                    <PlayerProgressBar />
                  </View>
                  <View>
                    <SeekIndicator />
                    <PlaybackControls />
                    <ChapterControls />
                  </View>
                </View>
                <PlayerScrubber />
              </Animated.View>
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
