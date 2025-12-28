import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";

import { FinishPlaythroughDialog, ResumePlaythroughDialog } from "@/components";
import { CustomTabBar, CustomTabBarWithPlayer } from "@/components/screens";
import { usePlayer } from "@/stores/player";
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
  const mediaId = usePlayer((state) => state.mediaId);
  const pendingResumePrompt = usePlayer((state) => state.pendingResumePrompt);
  const pendingFinishPrompt = usePlayer((state) => state.pendingFinishPrompt);
  const playerVisible = !!mediaId;

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
      {playerVisible ? (
        <CustomTabBarWithPlayer session={session} mediaId={mediaId} />
      ) : (
        <CustomTabBar />
      )}
      {pendingFinishPrompt && (
        <FinishPlaythroughDialog
          session={session}
          prompt={pendingFinishPrompt}
        />
      )}
      {pendingResumePrompt && (
        <ResumePlaythroughDialog
          session={session}
          prompt={pendingResumePrompt}
        />
      )}
    </>
  );
}
