import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";

const screenOptions: NativeStackNavigationOptions =
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
