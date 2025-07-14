import { Delay } from "@/src/components";
import { MediaScreen } from "@/src/components/screens";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

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
