import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Stack } from "expo-router";
import { Platform } from "react-native";

const getId = ({ params }: { params?: Record<string, any> | undefined }) =>
  params?.id;

const headerOptions: NativeStackNavigationOptions =
  Platform.OS === "ios"
    ? {
        headerLargeTitle: true,
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
      <Stack.Screen name="media/[id]" getId={getId} options={headerOptions} />
      <Stack.Screen name="person/[id]" getId={getId} options={headerOptions} />
      <Stack.Screen name="series/[id]" getId={getId} options={headerOptions} />
      <Stack.Screen name="book/[id]" getId={getId} options={headerOptions} />
    </Stack>
  );
}
