import TabBar from "@/src/components/TabBar";
import TabBarWithPlayer from "@/src/components/TabBarWithPlayer";
import { usePlayer } from "@/src/stores/player";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Tabs } from "expo-router";
import colors from "tailwindcss/colors";

export default function AppTabLayout() {
  const mediaId = usePlayer((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.lime[400],
        tabBarStyle: playerVisible ? { borderTopWidth: 0 } : {},
        tabBarLabelStyle: { paddingBottom: 4 },
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
