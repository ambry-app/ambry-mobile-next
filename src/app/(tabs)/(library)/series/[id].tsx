import { Delay } from "@/src/components";
import { SeriesDetailsFlatList } from "@/src/components/SeriesDetailsScreen/";
import { useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { Stack, useLocalSearchParams } from "expo-router";

export default function SeriesDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: seriesId, title } = useLocalSearchParams<RouterParams>();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Delay delay={10}>
        <SeriesDetailsFlatList session={session} seriesId={seriesId} />
      </Delay>
    </>
  );
}
