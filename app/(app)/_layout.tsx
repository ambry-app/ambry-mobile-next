import { Redirect, Stack } from "expo-router";

import LargeActivityIndicator from "@/components/LargeActivityIndicator";
import { useSession } from "@/contexts/session";
import { Text, View } from "react-native";

export default function AppLayout() {
  const { session, isLoading } = useSession();

  // You can keep the splash screen open, or render a loading screen like we do here.
  if (isLoading) {
    return (
      <View className="flex h-full items-center justify-center">
        <Text className="text-zinc-100 mb-2">Loading session...</Text>
        <LargeActivityIndicator className="mt-4" />
      </View>
    );
  }

  // Only require authentication within the (app) group's layout as users
  // need to be able to access the (auth) group and sign in again.
  if (!session?.token) {
    // On web, static rendering will stop here as the user is not authenticated
    // in the headless Node process that the pages are rendered in.
    return <Redirect href="/sign-in" />;
  }

  // This layout can be deferred because it's not the root layout.
  return <Stack />;
}
