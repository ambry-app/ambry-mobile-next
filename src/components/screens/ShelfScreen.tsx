import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { usePullToRefresh } from "@/services/sync-service";
import { Session } from "@/types/session";

import { NowPlaying } from "./shelf-screen/NowPlaying";
import { RecentInProgress } from "./shelf-screen/RecentInProgress";
import { RecentlyFinished } from "./shelf-screen/RecentlyFinished";
import { SavedForLater } from "./shelf-screen/SavedForLater";

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
