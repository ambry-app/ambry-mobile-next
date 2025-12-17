import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Session } from "@/stores/session";

import {
  NowPlaying,
  RecentInProgress,
  RecentlyFinished,
  SavedForLater,
} from "./shelf-screen";

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
      <RecentlyFinished session={session} />
      <SavedForLater session={session} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
});
