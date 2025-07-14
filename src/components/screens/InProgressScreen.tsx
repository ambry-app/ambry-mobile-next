import { FadeInOnMount, Loading, PlayerStateTile } from "@/src/components";
import { PAGE_SIZE } from "@/src/constants";
import { getPlayerStatesPage } from "@/src/db/library";
import { usePaginatedLibraryData } from "@/src/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";

type InProgressScreenProps = {
  session: Session;
};

export function InProgressScreen({ session }: InProgressScreenProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getPlayerStatesPage(session, pageSize, "in_progress", mediaId, cursor);
  const getCursor = (item: { updatedAt: Date }) => item.updatedAt;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor, [
    mediaId,
  ]);
  const { items: playerStates, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!playerStates) return null;

  if (playerStates.length === 0) {
    return <Text style={styles.text}>You have no unfinished audiobooks!</Text>;
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={playerStates}
      keyExtractor={(item) => item.media.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <PlayerStateTile playerState={item} session={session} />
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
