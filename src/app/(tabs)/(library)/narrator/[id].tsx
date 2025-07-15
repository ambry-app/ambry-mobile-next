import { Delay } from "@/src/components";
import { NarratorScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function NarratorRoute() {
  const session = useSession((state) => state.session);
  const { id: narratorId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <NarratorScreen session={session} narratorId={narratorId} />
      </Delay>
    </>
  );
}
