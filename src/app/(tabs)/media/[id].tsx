import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components";
import { MediaScreen } from "@/components/screens";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function MediaRoute() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <MediaScreen session={session} mediaId={mediaId} />
      </Delay>
    </>
  );
}
