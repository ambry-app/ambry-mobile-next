import { syncDown } from "@/src/db/sync";
import { Session } from "@/src/stores/session";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { NowPlaying, RecentInProgress } from "./shelf";

// sections:
// 1. now listening
// 2. in-progress
// 3. saved for later (coming soon)
// 4. finished (coming soon)

type ShelfProps = {
  session: Session;
};

export function Shelf(props: ShelfProps) {
  const { session } = props;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDown(session);
    } catch (error) {
      console.error("Pull-to-refresh sync error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [session]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <NowPlaying session={session} />
      <RecentInProgress session={session} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
});
