import "@/assets/global.css";
import Loading from "@/src/components/Loading";
import MeasureScreenHeight from "@/src/components/MeasureScreenHeight";
import ScreenCentered from "@/src/components/ScreenCentered";
import { expoDb } from "@/src/db/db";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { ThemeProvider } from "@react-navigation/native";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import colors from "tailwindcss/colors";

SystemUI.setBackgroundColorAsync("black");

const Theme = {
  dark: true,
  colors: {
    primary: colors.lime[400],
    background: colors.black,
    card: colors.zinc[900],
    text: colors.zinc[100],
    border: colors.zinc[600],
    notification: colors.red[400],
  },
};

export default function RootStackLayout() {
  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync(colors.transparent);
      NavigationBar.setPositionAsync("absolute");
    }
  });

  return (
    <GestureHandlerRootView>
      <MeasureScreenHeight />
      {__DEV__ && <DrizzleStudio />}
      <ThemeProvider value={Theme}>
        <Root />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const { isReady, migrateError } = useAppBoot();

  if (migrateError) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="text-zinc-100">
          The app failed to initialize in an irrecoverable way. Please delete
          the app's data and start fresh.
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
      <Stack.Screen name="sign-out" options={{ title: "Signing out..." }} />
    </Stack>
  );
}

function DrizzleStudio() {
  useDrizzleStudio(expoDb);
  return null;
}
