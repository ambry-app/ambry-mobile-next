import { ThemeProvider } from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from "expo-router";
import { Text, View } from "react-native";
import colors from "tailwindcss/colors";

import "@/assets/global.css";
import migrations from "@/drizzle/migrations";
import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import { SessionProvider } from "@/src/contexts/session";
import { db, expoDb } from "@/src/db/db";

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
        <Text className="text-red-500">Migration error: {error.message}</Text>
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
