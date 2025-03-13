import migrations from "@/drizzle/migrations";
import { Loading, MeasureScreenHeight, ScreenCentered } from "@/src/components";
import { db, expoDb } from "@/src/db/db";
import { Colors } from "@/src/styles";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: "https://c8e5cc7362c025baf903cd430a1e7951@o4508967734149120.ingest.us.sentry.io/4508967737950208",
  tracesSampleRate: __DEV__ ? 0.0 : 0.1,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: true,
  spotlight: __DEV__,
});

const Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    primary: Colors.lime[400],
    background: Colors.black,
    card: Colors.zinc[900],
    text: Colors.zinc[100],
    border: Colors.zinc[600],
    notification: Colors.red[400],
  },
};

function RootStackLayout() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

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

export default Sentry.wrap(RootStackLayout);

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
    color: Colors.zinc[100],
  },
});
