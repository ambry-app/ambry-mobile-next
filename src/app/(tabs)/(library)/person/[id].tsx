import { PersonDetails } from "@/src/components/screens";
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
      <PersonDetails session={session} personId={personId} />
    </>
  );
}
