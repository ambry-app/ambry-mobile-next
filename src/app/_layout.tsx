import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack, useNavigationContainerRef } from "expo-router";
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";

import { ErrorScreen } from "@/components/ErrorScreen";
import { MeasureScreenHeight } from "@/components/MeasureScreenHeight";
import { SyncProgress } from "@/components/SyncProgress";
import { getExpoDb } from "@/db/db";
import { BootError, BootErrorKind, useAppBoot } from "@/services/boot-service";
import { useRefreshLibraryDataVersion } from "@/services/data-version-service";
import { useForegroundSync } from "@/services/sync-service";
import { clearSession, useSession } from "@/stores/session";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors, surface } from "@/styles/colors";
import { StackScreenOptionsProp } from "@/types/router";
import { useAppState } from "@/utils/hooks";

import "core-js/actual/object/group-by";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  fade: true,
});

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const sentryEnvironment =
  Application.applicationId === "app.ambry.mobile"
    ? "production"
    : Application.applicationId === "app.ambry.mobile.preview"
      ? "preview"
      : "development";

Sentry.init({
  // No DSN outside production/preview: it also silences the native layer,
  // which captures service crashes and app hangs before JS runs - dev builds
  // and CI's Release smoke binaries were reporting through it.
  dsn:
    sentryEnvironment === "development"
      ? undefined
      : "https://c8e5cc7362c025baf903cd430a1e7951@o4508967734149120.ingest.us.sentry.io/4508967737950208",
  environment: sentryEnvironment,
  tracesSampleRate: __DEV__ ? 0.0 : 0.1,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: true,
  enabled: !__DEV__ && sentryEnvironment !== "development",
  enableLogs: !__DEV__,
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

function bootErrorMessage(error: BootError): string {
  switch (error.kind) {
    case BootErrorKind.NETWORK:
      return "Could not reach your server. Check your connection and your server address, then try again.";
    case BootErrorKind.SERVER:
      return "Your server returned an error. Try again, or contact the server admin if it keeps happening.";
    case BootErrorKind.UNEXPECTED:
      return "Something went wrong while setting up your library on this device. Try again, or sign out and back in.";
  }
}

function RootStackLayout() {
  useSentryNavigationIntegration();
  const { isReady, migrationError, initialSyncComplete, bootError, retryBoot } =
    useAppBoot();
  const isLoggedIn = useSession((state) => !!state.session);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (migrationError) {
    return (
      <ErrorScreen
        title="Ambry couldn't start"
        message="The app failed to initialize in an irrecoverable way. Please delete the app's data and start fresh."
      />
    );
  }

  if (!isReady) {
    return null;
  }

  // Boot got far enough to know it failed - say so instead of spinning forever
  if (bootError) {
    return (
      <ErrorScreen
        title="Ambry couldn't finish setting up"
        message={bootErrorMessage(bootError)}
        onRetry={retryBoot}
        onSignOut={isLoggedIn ? clearSession : undefined}
      />
    );
  }

  // Report what the first sync is doing if logged in but not yet finished
  if (isLoggedIn && !initialSyncComplete) {
    return <SyncProgress />;
  }

  return (
    <>
      {__DEV__ && <DrizzleStudio />}
      <KeyboardProvider>
        <GestureHandlerRootView>
          <MeasureScreenHeight />
          <ThemeProvider value={Theme}>
            <RootStack />
          </ThemeProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </>
  );
}

function DrizzleStudio() {
  useDrizzleStudio(getExpoDb());
  return null;
}

function RootStack() {
  const isLoggedIn = useSession((state) => !!state.session);
  const playerLoaded = useTrackPlayer((state) => !!state.playthrough);

  const appState = useAppState();
  useForegroundSync(appState);
  useRefreshLibraryDataVersion(appState);

  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sleep-timer" options={modalOptions} />
        <Stack.Screen name="playback-rate" options={modalOptions} />
        <Stack.Protected guard={playerLoaded}>
          <Stack.Screen name="chapter-select" options={chapterSelectOptions} />
        </Stack.Protected>
        <Stack.Screen name="resume-prompt" options={modalOptions} />
        <Stack.Screen name="mark-finished-prompt" options={modalOptions} />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default Sentry.wrap(RootStackLayout);

const Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    primary: Colors.lime[400],
    background: surface.base,
    card: surface.card,
    text: Colors.zinc[100],
    border: Colors.zinc[600],
    notification: Colors.red[400],
  },
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: surface.overlay,
  },
});

const modalOptions: StackScreenOptionsProp = {
  headerShown: false,
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
  contentStyle: styles.modalContent,
};

const chapterSelectOptions: StackScreenOptionsProp = {
  presentation: "modal",
  headerTitle: "Select Chapter",
  contentStyle: styles.modalContent,
};
