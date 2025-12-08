import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components";
import { NarratorScreen } from "@/components/screens";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

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
