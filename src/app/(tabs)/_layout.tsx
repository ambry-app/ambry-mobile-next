import NamesList from "@/src/components/NamesList";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { useMediaDetails } from "@/src/hooks/use.media.details";
import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
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
      tabBar={(props) => <TabBarWithPlayer {...props} />}
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

function TabBarWithPlayer({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <View className="flex">
      {playerVisible && <FloatingPlayer />}
      <BottomTabBar {...{ state, descriptors, navigation, insets }} />
    </View>
  );
}

function FloatingPlayer() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const { media } = useMediaDetails(mediaId);

  if (!media) {
    return null;
  }

  return (
    <View className="flex flex-row items-center p-2 px-4 gap-4 border-t-[0.25px] border-zinc-600 bg-zinc-900">
      <ThumbnailImage
        downloadedThumbnails={media.download?.thumbnails}
        thumbnails={media.thumbnails}
        size="small"
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
  );
}
