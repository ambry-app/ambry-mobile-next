import { Loading, MeasureScreenHeight, ScreenCentered } from "@/src/components";
import { expoDb } from "@/src/db/db";
import { useAppBoot } from "@/src/hooks/use.app.boot";
import { useSession } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useSQLiteDevTools } from "expo-sqlite-devtools";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { usePlayer } from "../stores/player";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  fade: true,
});

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: "https://c8e5cc7362c025baf903cd430a1e7951@o4508967734149120.ingest.us.sentry.io/4508967737950208",
  tracesSampleRate: __DEV__ ? 0.0 : 0.1,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: true,
  enabled: !__DEV__,
});

function useSentryNavigationIntegration() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  return ref;
}

function RootLayout() {
  useSentryNavigationIntegration();
  const { isReady, migrationError } = useAppBoot();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (migrationError) {
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
    return null;
  }

  return (
    <>
      {__DEV__ && <SQLiteDevTools />}
      <KeyboardProvider>
        <GestureHandlerRootView>
          <MeasureScreenHeight />
          <ThemeProvider value={Theme}>
            <RootStackLayout />
          </ThemeProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </>
  );
}

function SQLiteDevTools() {
  useSQLiteDevTools(expoDb);
  return null;
}

function RootStackLayout() {
  const isLoggedIn = useSession((state) => !!state.session);
  const playerLoaded = usePlayer((state) => !!state.mediaId);

  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Protected guard={playerLoaded}>
          <Stack.Screen name="sleep-timer" options={modalOptions} />
          <Stack.Screen name="playback-rate" options={modalOptions} />
          <Stack.Screen name="chapter-select" options={chapterSelectOptions} />
        </Stack.Protected>
        <Stack.Screen
          name="download-actions-modal/[id]"
          options={modalOptions}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default Sentry.wrap(RootLayout);

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

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
  },
  modalContent: {
    backgroundColor: Colors.zinc[900],
  },
});

const modalOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  contentStyle: styles.modalContent,
};

const chapterSelectOptions: NativeStackNavigationOptions = {
  presentation: "modal",
  headerTitle: "Select Chapter",
  contentStyle: styles.modalContent,
};
