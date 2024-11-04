import { useSession } from "@/src/stores/session";
import { Redirect, Stack } from "expo-router";

export default function AppStackLayout() {
  const session = useSession((state) => state.session);

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="sleep-timer"
        options={{ presentation: "modal", title: "Sleep Timer" }}
      />
      <Stack.Screen
        name="playback-rate"
        options={{ presentation: "modal", title: "Playback Speed" }}
      />
      <Stack.Screen
        name="chapter-select"
        options={{ presentation: "modal", title: "Chapter Select" }}
      />
    </Stack>
  );
}
