import { FlatList, StyleSheet, Text } from "react-native";

import { FadeInOnMount, Loading, MediaTile, TimeAgo } from "@/components";
import { PAGE_SIZE } from "@/constants";
import { getSavedMediaPage } from "@/db/shelves";
import { usePaginatedLibraryData } from "@/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useDataVersion } from "@/stores/data-version";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

type SavedForLaterScreenProps = {
  session: Session;
};

export function SavedForLaterScreen({ session }: SavedForLaterScreenProps) {
  const shelfDataVersion = useDataVersion((state) => state.shelfDataVersion);
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getSavedMediaPage(session, pageSize, cursor);
  const getCursor = (item: { addedAt: Date }) => item.addedAt;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor, [
    shelfDataVersion,
  ]);
  const { items: savedMedia, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!savedMedia) return null;

  if (savedMedia.length === 0) {
    return <Text style={styles.text}>You have no saved audiobooks!</Text>;
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={savedMedia}
      keyExtractor={(item) => item.media.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <TimeAgo date={item.addedAt} />
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
