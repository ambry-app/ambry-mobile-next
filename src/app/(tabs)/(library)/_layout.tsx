import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { Platform } from "react-native";

const headerOptions: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? {
        // headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterialDark",
      }
    : {};

export default function LibraryStackLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Library", ...headerOptions }}
      />
      <Stack.Screen name="media/[id]" options={headerOptions} />
      <Stack.Screen name="person/[id]" options={headerOptions} />
      <Stack.Screen name="series/[id]" options={headerOptions} />
      <Stack.Screen name="book/[id]" options={headerOptions} />
    </Stack>
  );
}
