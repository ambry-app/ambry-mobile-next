import { FadeInOnMount, Loading, SeriesBookTile } from "@/src/components";
import { PAGE_SIZE } from "@/src/constants";
import { getSeriesBooksPage, getSeriesDetails } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePaginatedLibraryData } from "@/src/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { FlatList, StyleSheet } from "react-native";
import { Header } from "./series-screen";

type SeriesScreenProps = {
  seriesId: string;
  session: Session;
};

export function SeriesScreen({ seriesId, session }: SeriesScreenProps) {
  const series = useLibraryData(() => getSeriesDetails(session, seriesId));

  const getPage = (pageSize: number, cursor: string | undefined) =>
    getSeriesBooksPage(session, seriesId, pageSize, cursor);
  const getCursor = (item: { bookNumber: string }) => item.bookNumber;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: seriesBooks, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!series) return null;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={seriesBooks}
      keyExtractor={(item) => item.id}
      numColumns={2}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={() => (
        <FadeInOnMount>
          <Header authorsAndNarrators={series.authorsAndNarrators} />
        </FadeInOnMount>
      )}
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
      renderItem={({ item }) => {
        return (
          <FadeInOnMount style={styles.tile}>
            <SeriesBookTile seriesBook={item} />
          </FadeInOnMount>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flatlist: {
    paddingHorizontal: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
