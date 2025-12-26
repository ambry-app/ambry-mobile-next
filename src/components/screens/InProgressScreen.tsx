import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { Loading, PlaythroughTile, TimeAgo } from "@/components";
import { PAGE_SIZE } from "@/constants";
import { getPlaythroughsPage } from "@/db/library";
import { usePaginatedLibraryData } from "@/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type InProgressScreenProps = {
  session: Session;
};

export function InProgressScreen({ session }: InProgressScreenProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getPlaythroughsPage(session, pageSize, "in_progress", mediaId, cursor);
  const getCursor = (item: { updatedAt: Date }) => item.updatedAt;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor, [
    mediaId,
  ]);
  const { items: playthroughs, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!playthroughs) return null;

  if (playthroughs.length === 0) {
    return <Text style={styles.text}>You have no unfinished audiobooks!</Text>;
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={playthroughs}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <View style={styles.tile}>
          {item.lastListenedAt && <TimeAgo date={item.lastListenedAt} />}
          <PlaythroughTile playthrough={item} />
        </View>
      )}
      removeClippedSubviews={Platform.OS === "android"}
      maxToRenderPerBatch={10}
      windowSize={5}
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
