import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { NowPlaying, RecentInProgress } from "./shelf-screen";

// sections:
// 1. now listening
// 2. in-progress
// 3. saved for later (coming soon)
// 4. finished (coming soon)

type ShelfScreenProps = {
  session: Session;
};

export function ShelfScreen(props: ShelfScreenProps) {
  const { session } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);

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
