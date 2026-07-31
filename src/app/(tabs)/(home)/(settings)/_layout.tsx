import { Platform } from "react-native";
import { Stack } from "expo-router";

import { StackScreenOptions } from "@/types/router";

const screenOptions: StackScreenOptions =
  Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function SettingsStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
