import { MediaDetailsFlatList } from "@/src/components/MediaDetailsScreen";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function MediaDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: mediaId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <MediaDetailsFlatList session={session} mediaId={mediaId} />
    </>
  );
}
