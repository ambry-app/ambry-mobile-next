import { PersonDetailsFlatList } from "@/src/components/PersonDetailsScreen";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function PersonDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PersonDetailsFlatList session={session} personId={personId} />
    </>
  );
}
