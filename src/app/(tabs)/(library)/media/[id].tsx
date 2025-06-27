import { MediaDetailsSections } from "@/src/components/MediaDetailsScreen";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function MediaDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <MediaDetailsSections session={session} mediaId={mediaId} />
    </>
  );
}
