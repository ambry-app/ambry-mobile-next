import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { Loading } from "@/components/Loading";
import { MediaTile } from "@/components/Tiles";
import { TimeAgo } from "@/components/TimeAgo";
import { PAGE_SIZE } from "@/constants";
import {
  getPlaythroughsPage,
  usePaginatedLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

type FinishedScreenProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
};

export function FinishedScreen({
  session,
  scrollHandler,
}: FinishedScreenProps) {
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getPlaythroughsPage(session, pageSize, "finished", null, cursor);
  // finishedAt is always set for finished playthroughs
  const getCursor = (item: { finishedAt: Date | null }) => item.finishedAt!;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: playthroughs, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!playthroughs) return null;

  if (playthroughs.length === 0) {
    return (
      <Text style={styles.text}>You haven't finished any audiobooks yet!</Text>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      data={playthroughs}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          {item.finishedAt && (
            <TimeAgo date={item.finishedAt} prefix="finished" />
          )}
          <MediaTile media={item.media} />
        </FadeInOnMount>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
