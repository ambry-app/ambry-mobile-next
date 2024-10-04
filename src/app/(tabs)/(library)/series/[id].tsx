import LargeActivityIndicator from "@/src/components/LargeActivityIndicator";
import ScreenCentered from "@/src/components/ScreenCentered";
import { SeriesForDetails, getSeriesForDetails } from "@/src/db/library";
import { syncDown } from "@/src/db/sync";
import { useSessionStore } from "@/src/stores/session";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";

export default function SeriesDetails() {
  const session = useSessionStore((state) => state.session);
  const { id: seriesId } = useLocalSearchParams<{ id: string }>();
  const [series, setSeries] = useState<SeriesForDetails | undefined>();
  const [error, setError] = useState(false);

  const loadSeries = useCallback(() => {
    getSeriesForDetails(session!, seriesId)
      .then(setSeries)
      .catch((error) => {
        console.error("Failed to load series:", error);
        setError(true);
      });
  }, [session, seriesId]);

  useFocusEffect(
    useCallback(() => {
      console.log("series/[id] focused!");

      // load what's in the DB right now
      loadSeries();

      // sync in background, then load again
      // if network is down, we just ignore the error
      syncDown(session!)
        .then(loadSeries)
        .catch((error) => {
          console.error("sync error:", error);
        });

      return () => {
        console.log("series/[id] unfocused");
      };
    }, [loadSeries, session]),
  );

  if (series === undefined) {
    return (
      <ScreenCentered>
        <LargeActivityIndicator />
      </ScreenCentered>
    );
  }

  if (error) {
    console.error("Failed to load series:", error);

    return (
      <ScreenCentered>
        <Text className="text-red-500">Failed to load series!</Text>
      </ScreenCentered>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: series.name }} />
      <ScrollView></ScrollView>
    </>
  );
}
