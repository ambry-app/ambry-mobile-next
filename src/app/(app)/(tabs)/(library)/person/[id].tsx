import PersonDetailsFlatList from "@/src/components/PersonDetailsScreen/PersonDetailsFlatList";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function PersonDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PersonDetailsFlatList session={session} personId={personId} />
    </>
  );
}
