import IconButton from "@/src/components/IconButton";
import NamesList from "@/src/components/NamesList";
import PlayerButtons from "@/src/components/PlayerButtons";
import PlayerProgressBar from "@/src/components/PlayerProgressBar";
import PlayerScrubber from "@/src/components/PlayerScrubber";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import useBackHandler from "@/src/hooks/use.back.handler";
import { useMediaDetails } from "@/src/hooks/use.media.details";
import { useScreenStore } from "@/src/stores/screen";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
  const tabBarHeight = 50 + insets.bottom;
  return (
    <BottomTabBar
      style={{ height: tabBarHeight }}
      {...{ state, descriptors, navigation, insets }}
    />
  );
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
  const { screenHeight, screenWidth } = useScreenStore((state) => state);
  const whereItWas = useSharedValue(0);
  const onEnd = useSharedValue(0);

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

  const leftGutterStyle = useAnimatedStyle(() => {
    return {
      // padding: interpolate(
      //   expansion.value,
      //   [0, 0.75],
      //   [0, 8],
      //   Extrapolation.CLAMP,
      // ),
      width: interpolate(
        expansion.value,
        [0, 0.75],
        [0, tenPercentScreenWidth],
        Extrapolation.CLAMP,
      ),
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
      // width: `${interpolate(expansion.value, [0, 1], [20, 80])}%`,
      // paddingLeft: interpolate(expansion.value, [0, 1], [16, 0]),
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
      // paddingRight: interpolate(expansion.value, [0, 1], [16, 0]),
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
      // fly in from below:
      // paddingTop: interpolate(expansion.value, [0.75, 1], [32, 0]),
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
      // fly in from below:
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
                onPress={() => console.log("TODO: collapse player")}
              />

              <IconButton
                size={24}
                icon="ellipsis-vertical"
                color={colors.zinc[100]}
                onPress={() => console.log("TODO: context menu")}
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
                <View style={{}}>
                  <IconButton
                    size={32}
                    icon="play"
                    color={colors.zinc[100]}
                    onPress={() => console.log("TODO: toggle playback")}
                  />
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
                <Text
                  className="text-xl text-zinc-100 font-bold"
                  numberOfLines={1}
                >
                  {media.book.title}
                </Text>
                <NamesList
                  names={media.book.bookAuthors.map((ba) => ba.author.name)}
                  className="text-lg text-zinc-300 leading-tight"
                  numberOfLines={1}
                />
                <NamesList
                  prefix="Read by"
                  names={media.mediaNarrators.map((mn) => mn.narrator.name)}
                  className="text-zinc-400 leading-tight"
                  numberOfLines={1}
                />
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
