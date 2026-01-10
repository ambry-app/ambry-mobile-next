import { Tabs } from "expo-router";

import { useSession } from "@/stores/session";

export default function HomeTabsLayout() {
  const session = useSession((state) => state.session);

  if (!session) return null;

  return (
    <Tabs
      screenOptions={{
        // animation: "shift",
        // Hide the built-in tab bar since we render a custom one at the wrapper level
        tabBarStyle: { display: "none" },
      }}
      backBehavior="history"
    >
      <Tabs.Screen
        name="(shelf)"
        options={{
          headerShown: false,
          title: "My Shelf",
        }}
      />
      <Tabs.Screen
        name="(library)"
        options={{
          headerShown: false,
          title: "Library",
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: "Downloads",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
