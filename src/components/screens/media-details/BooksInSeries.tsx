import {
  FadeInOnMount,
  HeaderButton,
  SeeAllTile,
  SeriesBookTile,
} from "@/src/components";
import {
  getSeriesWithBooks,
  MediaHeaderInfo,
  SeriesWithBooks,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

const LIMIT = 10;

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
      LIMIT,
    ),
  );

  if (!seriesList) return null;
  if (seriesList.length === 0) return null;

  return (
    <FadeInOnMount>
      {seriesList.map((series) => (
        <BooksInOneSeries key={`series-${series.id}`} series={series} />
      ))}
    </FadeInOnMount>
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

  const hasMore = series.seriesBooks.length === LIMIT;

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
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToSeries}
              style={{ width: screenWidth / 2.5, height: screenWidth / 2.5 }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <SeriesBookTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              seriesBook={item}
            />
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
  listSpacer: {
    width: 16,
  },
  tile: {
    marginRight: 16,
  },
});
