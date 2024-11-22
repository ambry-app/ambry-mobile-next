import "@/assets/global.css";
import migrations from "@/drizzle/migrations";
import Loading from "@/src/components/Loading";
import MeasureScreenHeight from "@/src/components/MeasureScreenHeight";
import ScreenCentered from "@/src/components/ScreenCentered";
import { db, expoDb } from "@/src/db/db";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
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
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success) {
      SplashScreen.hideAsync();
    }
  }, [success]);

  if (error) {
    return (
      <ScreenCentered>
        <Text style={styles.text}>
          The app failed to initialize in an irrecoverable way. Please delete
          the app's data and start fresh.
        </Text>
      </ScreenCentered>
    );
  }

  if (!success) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-out" options={{ headerShown: false }} />
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
