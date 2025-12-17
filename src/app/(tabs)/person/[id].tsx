import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components";
import { PersonScreen } from "@/components/screens";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function PersonRoute() {
  const session = useSession((state) => state.session);
  const { id: personId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <PersonScreen session={session} personId={personId} />
      </Delay>
    </>
  );
}
