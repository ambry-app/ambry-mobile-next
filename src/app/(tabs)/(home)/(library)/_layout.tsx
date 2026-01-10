import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";

const screenOptions: NativeStackNavigationOptions =
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
