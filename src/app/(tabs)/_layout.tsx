import NamesList from "@/src/components/NamesList";
import ThumbnailImage, {
  ThumbnailImageNative,
  ThumbnailImageNoTW,
} from "@/src/components/ThumbnailImage";
import useBackHandler from "@/src/hooks/use.back.handler";
import { useMediaDetails } from "@/src/hooks/use.media.details";
import { useScreenStore } from "@/src/stores/screen";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import colors from "tailwindcss/colors";

export default function TabLayout() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.lime[400],
        tabBarStyle: playerVisible ? { borderTopWidth: 0 } : {},
      }}
      tabBar={(props) =>
        playerVisible ? <TabBarWithPlayer {...props} /> : <TabBar {...props} />
      }
    >
      <Tabs.Screen
        name="(library)"
        options={{
          headerShown: false,
          title: "Library",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="book-open" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shelf"
        options={{
          title: "Shelf",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="book-bookmark" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: "Downloads",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="download" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="gear" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return <BottomTabBar {...{ state, descriptors, navigation, insets }} />;
}

function TabBarWithPlayer({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const { media } = useMediaDetails(mediaId);
  const expansion = useSharedValue(1.0);
  const { height: screenHeight } = useScreenStore((state) => state);
  const whereItWas = useSharedValue(0);
  const onEnd = useSharedValue(0);

  const tabBarHeight = 50 + insets.bottom;
  const playerHeight = 80;

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

      if (e.velocityY < -0) onEnd.value = 1.0;
      if (e.velocityY > 0) onEnd.value = 0.0;
    })
    .onEnd((e) => {
      expansion.value = withTiming(onEnd.value, {
        duration: 400,
        easing: Easing.out(Easing.exp),
      });
    });

  // const tapGesture = Gesture.Tap().onEnd((e) => {
  //   if (expansion.value === 1.0) {
  //     expansion.value = withTiming(0.0, {
  //       duration: 400,
  //       easing: Easing.out(Easing.exp),
  //     });
  //   } else if (expansion.value === 0.0) {
  //     expansion.value = withTiming(1.0, {
  //       duration: 400,
  //       easing: Easing.out(Easing.exp),
  //     });
  //   }
  // });

  const gestures = Gesture.Race(panGesture);

  useBackHandler(() => {
    if (expansion.value === 1.0) {
      expansion.value = withTiming(0.0, {
        duration: 400,
        easing: Easing.out(Easing.exp),
      });
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

  const chevronStyle = useAnimatedStyle(() => {
    return {
      // padding: interpolate(
      //   expansion.value,
      //   [0, 0.75],
      //   [0, 8],
      //   Extrapolation.CLAMP,
      // ),
      width: `${interpolate(expansion.value, [0, 0.75], [0, 10], Extrapolation.CLAMP)}%`,
      // opacity: interpolate(
      //   expansion.value,
      //   [0.75, 1],
      //   [0, 1],
      //   Extrapolation.CLAMP,
      // ),
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(expansion.value, [0, 1], [20, 80])}%`,
      paddingLeft: interpolate(expansion.value, [0, 1], [16, 0]),
    };
  });

  const miniControlsStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(expansion.value, [0, 1], [80, 10])}%`,
      paddingRight: interpolate(expansion.value, [0, 1], [16, 0]),
      // opacity: interpolate(
      //   expansion.value,
      //   [0, 0.5],
      //   [1, 0],
      //   Extrapolation.CLAMP,
      // ),
    };
  });

  const controlsStyle = useAnimatedStyle(() => {
    return {
      paddingTop: interpolate(expansion.value, [0.75, 1], [32, 0]),
      // opacity: interpolate(
      //   expansion.value,
      //   [0.75, 1],
      //   [0, 1],
      //   Extrapolation.CLAMP,
      // ),
    };
  });

  if (!media) return null;

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
            <View
              style={{
                display: "flex",
                flexDirection: "row",
                // alignItems: "center",
                // justifyContent: "space-evenly",
                // paddingVertical: 8,
                // paddingHorizontal: 16,
                // gap: 16,
              }}
            >
              <Animated.View
                style={[
                  {
                    // marginTop: -8,
                    // alignSelf: "flex-start",
                    backgroundColor: colors.cyan[900],
                  },
                  chevronStyle,
                ]}
              >
                <Pressable onPress={() => console.log("lol?")}>
                  <FontAwesome6
                    size={24}
                    name="chevron-down"
                    color={colors.zinc[100]}
                  />
                </Pressable>
              </Animated.View>
              <Animated.View
                style={[
                  {
                    // display: "flex",
                    alignSelf: "center",
                    backgroundColor: colors.green[900],
                  },
                  imageStyle,
                ]}
              >
                <ThumbnailImageNoTW
                  downloadedThumbnails={media.download?.thumbnails}
                  thumbnails={media.thumbnails}
                  size="extraLarge"
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 6,
                  }}
                />
              </Animated.View>
              <Animated.View
                style={[
                  {
                    backgroundColor: colors.red[900],
                    height: playerHeight,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: 8,
                  },
                  miniControlsStyle,
                ]}
              >
                <View className="flex-1">
                  <Text className="text-zinc-100 font-medium" numberOfLines={1}>
                    {media.book.title}
                  </Text>
                  <NamesList
                    names={media.book.bookAuthors.map((ba) => ba.author.name)}
                    className="text-sm text-zinc-300 leading-tight"
                    numberOfLines={1}
                  />
                  <NamesList
                    prefix="Read by"
                    names={media.mediaNarrators.map((mn) => mn.narrator.name)}
                    className="text-xs text-zinc-400 leading-tight"
                    numberOfLines={1}
                  />
                </View>
                <View className="pr-2">
                  <Pressable
                    onPress={() => {
                      console.log("lol?");
                    }}
                  >
                    <FontAwesome6
                      size={24}
                      name="play"
                      color={colors.zinc[100]}
                    />
                  </Pressable>
                </View>
              </Animated.View>
            </View>
            <View
              style={{
                display: "flex",
                flexDirection: "row",
                // alignItems: "center",
                // justifyContent: "space-evenly",
                // paddingVertical: 8,
                // paddingHorizontal: 16,
                // gap: 16,
              }}
            >
              <View style={{ width: "10%" }}></View>
              <View style={{ width: "80%" }}>
                <Text className="text-zinc-100 font-medium" numberOfLines={1}>
                  {media.book.title}
                </Text>
                <NamesList
                  names={media.book.bookAuthors.map((ba) => ba.author.name)}
                  className="text-sm text-zinc-300 leading-tight"
                  numberOfLines={1}
                />
                <NamesList
                  prefix="Read by"
                  names={media.mediaNarrators.map((mn) => mn.narrator.name)}
                  className="text-xs text-zinc-400 leading-tight"
                  numberOfLines={1}
                />
              </View>
              <View style={{ width: "10%" }}></View>
            </View>
            <Animated.View
              style={[
                {
                  width: "100%",
                  flexGrow: 1,
                  display: "flex",
                  // justifyContent: "space-between",
                  paddingBottom: insets.bottom,
                  backgroundColor: colors.blue[900],
                },
                controlsStyle,
              ]}
            >
              <Text className="text-zinc-100 text-center bg-yellow-900 grow">
                Other stuff here
              </Text>
              <Text className="text-zinc-100 text-center bg-purple-900 grow">
                This is at the bottom
              </Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <Animated.View style={[{ height: tabBarHeight }, tabBarStyle]}>
          <BottomTabBar {...{ state, descriptors, navigation, insets }} />
        </Animated.View>
      </View>
    </>
  );
}

function FloatingPlayer() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const { media } = useMediaDetails(mediaId);
  const [expanded, setExpanded] = useState(true);

  useBackHandler(() => {
    if (expanded) {
      setExpanded(false);
      return true;
    }
    return false;
  });

  if (!media) return null;

  if (expanded) {
    return (
      <View className="bg-zinc-900 h-full flex">
        <SafeAreaView>
          <View className="gap-8">
            <View className="px-8 py-4 flex flex-row items-center">
              <Pressable onPress={() => setExpanded(false)}>
                <FontAwesome6
                  size={16}
                  name="chevron-down"
                  color={colors.zinc[100]}
                />
              </Pressable>
            </View>
            <View className="flex flex-row justify-center">
              <ThumbnailImage
                thumbnails={media.thumbnails}
                downloadedThumbnails={media.download?.thumbnails}
                size="extraLarge"
                className="w-3/4 aspect-square rounded-lg"
              />
            </View>
            <View className="flex flex-row justify-center">
              <Pressable
                onPress={() => {
                  console.log("lol?");
                }}
              >
                <FontAwesome6 size={64} name="play" color={colors.zinc[100]} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <Pressable onPress={() => setExpanded(true)}>
      <View
        className="flex flex-row items-center p-2 px-4 gap-4 border-zinc-600 bg-zinc-900"
        style={{ borderTopWidth: StyleSheet.hairlineWidth }}
      >
        <ThumbnailImage
          downloadedThumbnails={media.download?.thumbnails}
          thumbnails={media.thumbnails}
          size="extraLarge"
          className="w-16 h-16 rounded-md"
        />
        <View className="flex-1">
          <Text className="text-zinc-100 font-medium" numberOfLines={1}>
            {media.book.title}
          </Text>
          <NamesList
            names={media.book.bookAuthors.map((ba) => ba.author.name)}
            className="text-sm text-zinc-300 leading-tight"
            numberOfLines={1}
          />
          <NamesList
            prefix="Read by"
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            className="text-xs text-zinc-400 leading-tight"
            numberOfLines={1}
          />
        </View>
        <View className="pr-2">
          {/* TODO: play or pause depending on state */}
          <Pressable
            onPress={() => {
              console.log("lol?");
            }}
          >
            <FontAwesome6 size={24} name="play" color={colors.zinc[100]} />
          </Pressable>
        </View>
        {/* TODO: progress bar at bottom */}
      </View>
    </Pressable>
  );
}
