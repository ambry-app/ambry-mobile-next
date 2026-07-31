import { Platform } from "react-native";
import { Stack } from "expo-router";

import { StackScreenOptions } from "@/types/router";

const screenOptions: StackScreenOptions =
  Platform.OS === "ios"
    ? {
        // headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function LibraryStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "Library" }} />
    </Stack>
  );
}
