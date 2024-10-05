import { useSessionStore } from "@/src/stores/session";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
  const session = useSessionStore((state) => state.session);

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Library" }} />
      <Stack.Screen name="media/[id]" options={{ title: "" }} />
      <Stack.Screen name="person/[id]" options={{ title: "" }} />
      <Stack.Screen name="series/[id]" options={{ title: "" }} />
    </Stack>
  );
}
