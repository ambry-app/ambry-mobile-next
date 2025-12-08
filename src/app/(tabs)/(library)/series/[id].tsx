import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components";
import { SeriesScreen } from "@/components/screens";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function SeriesRoute() {
  const session = useSession((state) => state.session);
  const { id: seriesId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <SeriesScreen session={session} seriesId={seriesId} />
      </Delay>
    </>
  );
}
