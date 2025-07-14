import { Stack } from "expo-router";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const screenOptions: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? {
        // headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function ShelfStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "My Shelf",
        }}
      />
      <Stack.Screen
        name="in-progress"
        options={{
          title: "In Progress",
        }}
      />
    </Stack>
  );
}
