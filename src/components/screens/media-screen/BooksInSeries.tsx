import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import {
  FadeInOnMount,
  HeaderButton,
  SeeAllTile,
  SeriesBookTile,
} from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import {
  getSeriesWithBooks,
  MediaHeaderInfo,
  SeriesWithBooks,
} from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { useScreen } from "@/stores/screen";
import { Session } from "@/stores/session";

type BooksInSeriesProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function BooksInSeries(props: BooksInSeriesProps) {
  const { media, session } = props;
  const seriesList = useLibraryData(() =>
    getSeriesWithBooks(
      session,
      media.book.series.map(({ bookNumber, ...rest }) => rest),
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
        renderItem={({ item }) => {
          return (
            <FadeInOnMount style={[styles.tile, { width: tileSize }]}>
              <SeriesBookTile seriesBook={item} />
            </FadeInOnMount>
          );
        }}
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
