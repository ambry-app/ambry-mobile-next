import { ThemeProvider } from "@react-navigation/native";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from "expo-router";
import { openDatabaseSync } from "expo-sqlite/next";
import { Text, View } from "react-native";
import colors from "tailwindcss/colors";

import LargeActivityIndicator from "@/components/LargeActivityIndicator";
import { SessionProvider } from "@/contexts/session";
import migrations from "@/drizzle/migrations";
import "@/global.css";

const expoDb = openDatabaseSync("ambry.db");
const db = drizzle(expoDb);

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

export default function Root() {
  const { success, error } = useMigrations(db, migrations);
  useDrizzleStudio(expoDb);

  if (error) {
    return (
      <View className="bg-black flex h-full items-center justify-center">
        <Text className="text-red-500 mb-2">Migration error: {"foo"}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="bg-black flex h-full items-center justify-center">
        <Text className="text-zinc-100 mb-2">Migrating database...</Text>
        <LargeActivityIndicator className="mt-4" />
      </View>
    );
  }

  return (
    <SessionProvider>
      <ThemeProvider value={Theme}>
        <Stack>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
        </Stack>
      </ThemeProvider>
    </SessionProvider>
  );
}
