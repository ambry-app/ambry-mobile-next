import { syncDown } from "@/src/db/sync";
import { Session } from "@/src/stores/session";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
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
  const sections = ["now_playing", "in_progress"];
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
    <FlatList
      style={styles.container}
      data={sections}
      keyExtractor={(item) => item}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListFooterComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        if (item === "now_playing") return <NowPlaying session={session} />;
        if (item === "in_progress")
          return <RecentInProgress session={session} />;
        return null;
      }}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

const styles = StyleSheet.create({
  container: {},
  separator: {
    height: 32,
  },
});
