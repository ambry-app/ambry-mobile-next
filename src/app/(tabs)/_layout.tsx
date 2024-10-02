import { useTrackPlayerStore } from "@/src/stores/trackPlayer";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Tabs } from "expo-router";
import { View } from "react-native";
import colors from "tailwindcss/colors";

const tabBarHeight = 49;
const playerHeight = 64;

export default function TabLayout() {
  const mediaId = useTrackPlayerStore((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.lime[400],
          tabBarStyle: {
            height: tabBarHeight,
          },
        }}
        sceneContainerStyle={{
          paddingBottom: playerVisible ? playerHeight : 0,
        }}
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
      {playerVisible && (
        <View
          className="absolute bg-zinc-900"
          style={{
            left: 0,
            right: 0,
            bottom: tabBarHeight,
            height: playerHeight,
          }}
        >
          {/* put floating player here */}
        </View>
      )}
    </>
  );
}
