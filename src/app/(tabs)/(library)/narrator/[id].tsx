import { Delay } from "@/src/components";
import { NarratorDetails } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function NarratorScreen() {
  const session = useSession((state) => state.session);
  const { id: narratorId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <NarratorDetails session={session} narratorId={narratorId} />
      </Delay>
    </>
  );
}
