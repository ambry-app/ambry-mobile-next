import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import { useAppInit } from "@/src/hooks/use.app.init";
import { useSessionStore } from "@/src/stores/session";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

export default function AppLayout() {
  const { isReady } = useAppInit();
  const session = useSessionStore((state) => state.session);

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return isReady ? (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Library" }} />
      <Stack.Screen name="media/[id]" options={{ title: "" }} />
      <Stack.Screen name="person/[id]" options={{ title: "" }} />
      <Stack.Screen name="series/[id]" options={{ title: "" }} />
    </Stack>
  ) : (
    <View className="bg-black flex h-full items-center justify-center">
      <LargeActivityIndicator />
    </View>
  );
}
