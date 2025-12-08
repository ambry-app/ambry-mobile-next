import { FlatList, StyleSheet, Text } from "react-native";

import { FadeInOnMount, Loading, MediaTile, TimeAgo } from "@/components";
import { PAGE_SIZE } from "@/constants";
import { getPlaythroughsPage } from "@/db/library";
import { usePaginatedLibraryData } from "@/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type FinishedScreenProps = {
  session: Session;
};

export function FinishedScreen({ session }: FinishedScreenProps) {
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getPlaythroughsPage(session, pageSize, "finished", null, cursor);
  const getCursor = (item: { updatedAt: Date }) => item.updatedAt;
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
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={playthroughs}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          {item.finishedAt && <TimeAgo date={item.finishedAt} />}
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
