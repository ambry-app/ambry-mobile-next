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

export default function DownloadsStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="downloads" options={{ title: "Downloads" }} />
    </Stack>
  );
}
