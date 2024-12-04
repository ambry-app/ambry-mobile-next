import { SeriesDetailsFlatList } from "@/src/components/SeriesDetailsScreen/";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function SeriesDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: seriesId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SeriesDetailsFlatList session={session} seriesId={seriesId} />
    </>
  );
}
