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

export default function SettingsStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
