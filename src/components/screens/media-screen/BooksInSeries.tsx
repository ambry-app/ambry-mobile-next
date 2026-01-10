import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { HeaderButton } from "@/components/HeaderButton";
import { SeeAllTile } from "@/components/SeeAllTile";
import { SeriesBookTile } from "@/components/Tiles";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import {
  getSeriesWithBooks,
  MediaHeaderInfo,
  SeriesWithBooks,
  useLibraryData,
} from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

type BooksInSeriesProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function BooksInSeries(props: BooksInSeriesProps) {
  const { media, session } = props;
  const seriesList = useLibraryData(() =>
    getSeriesWithBooks(
      session,
      media.book.series.map(({ bookNumber: _bookNumber, ...rest }) => rest),
      HORIZONTAL_LIST_LIMIT,
    ),
  );

  if (!seriesList) return null;
  if (seriesList.length === 0) return null;

  return (
    <>
      {seriesList.map((series) => (
        <BooksInOneSeries key={`series-${series.id}`} series={series} />
      ))}
    </>
  );
}

type BooksInOneSeriesProps = {
  series: SeriesWithBooks[number];
};

function BooksInOneSeries(props: BooksInOneSeriesProps) {
  const { series } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  if (series.seriesBooks.length === 0) return null;

  const navigateToSeries = () => {
    router.navigate({
      pathname: "/series/[id]",
      params: { id: series.id, title: series.name },
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = series.seriesBooks.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={series.name}
          onPress={navigateToSeries}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        windowSize={3}
        initialNumToRender={4}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToSeries}
              style={{
                width: tileSize,
                height: tileSize,
              }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.tile, { width: tileSize }]}>
            <SeriesBookTile seriesBook={item} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  headerContainer: {
    paddingHorizontal: 16,
  },
  list: {
    paddingVertical: 8,
  },
  listHeader: {
    width: 16,
  },
  tile: {
    marginRight: HORIZONTAL_TILE_SPACING,
  },
});
