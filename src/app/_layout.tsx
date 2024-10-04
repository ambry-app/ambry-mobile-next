import "@/assets/global.css";
import migrations from "@/drizzle/migrations";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import { db, expoDb } from "@/src/db/db";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { ThemeProvider } from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import colors from "tailwindcss/colors";
import { useShallow } from "zustand/react/shallow";
import { useTrackPlayerStore } from "../stores/trackPlayer";

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
  useDrizzleStudio(expoDb);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(colors.zinc[900]);
  });

  return (
    <ThemeProvider value={Theme}>
      <Root />
      <StatusBar style="auto" backgroundColor={colors.zinc[900]} />
    </ThemeProvider>
  );
}

function Root() {
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { success: migrateSuccess, error: migrateError } = useMigrations(
    db,
    migrations,
  );
  const session = useSessionStore((state) => state.session);

  const [
    trackPlayerSetup,
    trackPlayerError,
    setupTrackPlayer,
    loadMostRecentMedia,
  ] = useTrackPlayerStore(
    useShallow((state) => [
      state.setup,
      state.setupError,
      state.setupTrackPlayer,
      state.loadMostRecentMedia,
    ]),
  );

  useEffect(() => {
    setupTrackPlayer();
  }, [setupTrackPlayer]);

  useEffect(() => {
    if (!session || !session.token) {
      setInitialSyncComplete(true);
      return;
    }

    if (migrateSuccess) {
      console.log("Initial app load sync...");
      syncDown(session)
        .then(() => {
          console.log("Initial app load sync complete");
          setInitialSyncComplete(true);
        })
        .catch((error) => {
          console.error("Initial app load sync error", error);
          setInitialSyncComplete(true);
        });
    }
  }, [migrateSuccess, session]);

  useEffect(() => {
    if (initialSyncComplete && trackPlayerSetup && session) {
      console.log("Initial track load...");
      loadMostRecentMedia(session);
    }
  }, [initialSyncComplete, trackPlayerSetup, session, loadMostRecentMedia]);

  if (migrateError) {
    return (
      <View className="bg-black flex h-full items-center justify-center">
        <Text className="text-red-500">
          Migration error: {migrateError.message}
        </Text>
      </View>
    );
  }

  if (trackPlayerError) {
    return (
      <View className="bg-black flex h-full items-center justify-center">
        <Text className="text-red-500">
          TrackPlayer error: {trackPlayerError.toString()}
        </Text>
      </View>
    );
  }

  if (!(migrateSuccess && trackPlayerSetup && initialSyncComplete)) {
    return (
      <View className="bg-black flex h-full items-center justify-center">
        <LargeActivityIndicator />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
    </Stack>
  );
}
