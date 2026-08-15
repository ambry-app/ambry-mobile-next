import { Platform } from "react-native";
import { Stack } from "expo-router";

import { CustomTabBar } from "@/components/screens/CustomTabBar";
import { CustomTabBarWithPlayer } from "@/components/screens/CustomTabBarWithPlayer";
import { useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { StackScreenOptions } from "@/types/router";

const screenOptions: StackScreenOptions =
  Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function TabsWrapperLayout() {
  const session = useSession((state) => state.session);
  const playthrough = useTrackPlayer((state) => state.playthrough);

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
        <Stack.Screen name="set/[id]" />
      </Stack>
      {playthrough ? (
        <CustomTabBarWithPlayer session={session} playthrough={playthrough} />
      ) : (
        <CustomTabBar />
      )}
    </>
  );
}
