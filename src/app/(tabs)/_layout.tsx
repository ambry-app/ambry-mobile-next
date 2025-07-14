import { TabBar } from "@/src/components";
import { TabBarWithPlayer } from "@/src/components/Player";
import { usePlayer } from "@/src/stores/player";
import { Session, useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return <AppTabs session={session} />;
}

function AppTabs({ session }: { session: Session }) {
  const mediaId = usePlayer((state) => state.mediaId);
  const playerVisible = !!mediaId;

  return (
    <Tabs
      screenOptions={{
        animation: "shift",
        tabBarActiveTintColor: Colors.lime[400],
        tabBarStyle: playerVisible ? { borderTopWidth: 0 } : {},
        tabBarLabelStyle: { paddingBottom: 4 },
      }}
      tabBar={(props) =>
        playerVisible ? (
          <TabBarWithPlayer {...props} session={session} mediaId={mediaId} />
        ) : (
          <TabBar {...props} />
        )
      }
      backBehavior="history"
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
        name="(shelf)"
        options={{
          headerShown: false,
          title: "My Shelf",
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
