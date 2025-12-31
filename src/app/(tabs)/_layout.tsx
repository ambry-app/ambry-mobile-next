import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";

import { CustomTabBar, CustomTabBarWithPlayer } from "@/components/screens";
import { usePlayerUIState } from "@/stores/player-ui-state";
import { useSession } from "@/stores/session";

const screenOptions: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function TabsWrapperLayout() {
  const session = useSession((state) => state.session);
  const loadedPlaythrough = usePlayerUIState(
    (state) => state.loadedPlaythrough,
  );

  if (!session) return null;

  return (
    <>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name="(home)"
          options={{ headerShown: false, title: "Back" }}
        />
        <Stack.Screen name="media/[id]" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="author/[id]" />
        <Stack.Screen name="narrator/[id]" />
        <Stack.Screen name="series/[id]" />
      </Stack>
      {loadedPlaythrough ? (
        <CustomTabBarWithPlayer
          session={session}
          loadedPlaythrough={loadedPlaythrough}
        />
      ) : (
        <CustomTabBar />
      )}
    </>
  );
}
