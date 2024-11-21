import "@/assets/global.css";
import Loading from "@/src/components/Loading";
import MeasureScreenHeight from "@/src/components/MeasureScreenHeight";
import ScreenCentered from "@/src/components/ScreenCentered";
import { expoDb } from "@/src/db/db";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import colors from "tailwindcss/colors";

const Theme = {
  ...DefaultTheme,
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
  return (
    <KeyboardProvider>
      <GestureHandlerRootView>
        <MeasureScreenHeight />
        {__DEV__ && <DrizzleStudio />}
        <ThemeProvider value={Theme}>
          <Root />
        </ThemeProvider>
      </GestureHandlerRootView>
    </KeyboardProvider>
  );
}

function Root() {
  const { isReady, migrateError } = useAppBoot();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (migrateError) {
    return (
      <ScreenCentered>
        <Text style={styles.text}>
          The app failed to initialize in an irrecoverable way. Please delete
          the app's data and start fresh.
        </Text>
      </ScreenCentered>
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

const styles = StyleSheet.create({
  text: {
    color: colors.zinc[100],
  },
});
