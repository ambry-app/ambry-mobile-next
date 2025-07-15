import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { Platform } from "react-native";

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
      <Stack.Screen name="media/[id]" />
      <Stack.Screen name="person/[id]" />
      <Stack.Screen name="series/[id]" />
      <Stack.Screen name="book/[id]" />
    </Stack>
  );
}
