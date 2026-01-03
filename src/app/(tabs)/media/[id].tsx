import { Stack, useLocalSearchParams } from "expo-router";

import { Delay } from "@/components";
import { MediaScreen } from "@/components/screens";
import { getMediaTitle } from "@/db/library";
import { useLibraryData } from "@/services/library-service";
import { useSession } from "@/stores/session";
import { RouterParams } from "@/types/router";

export default function MediaRoute() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title: paramTitle } =
    useLocalSearchParams<RouterParams>();

  // Only fetch title if not provided via params (e.g., deep links)
  const fetchedTitle = useLibraryData(
    async () =>
      !paramTitle && session ? getMediaTitle(session, mediaId) : null,
    [paramTitle, session, mediaId],
  );

  // Use param title if available, otherwise fall back to fetched title
  const title = paramTitle || fetchedTitle || undefined;

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
