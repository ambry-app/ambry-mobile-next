import "@/assets/global.css";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import { expoDb } from "@/src/db/db";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { ThemeProvider } from "@react-navigation/native";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import colors from "tailwindcss/colors";

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

export default function App() {
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(colors.zinc[900]);
  });

  return (
    <>
      <StatusBar style="auto" backgroundColor={colors.zinc[900]} />
      {__DEV__ && <DrizzleStudio />}
      <ThemeProvider value={Theme}>
        <Root />
      </ThemeProvider>
    </>
  );
}

function Root() {
  const { isReady } = useAppBoot();

  return isReady ? (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
    </Stack>
  ) : (
    <View className="bg-black flex h-full items-center justify-center">
      <LargeActivityIndicator />
    </View>
  );
}

function DrizzleStudio() {
  useDrizzleStudio(expoDb);
  return null;
}
