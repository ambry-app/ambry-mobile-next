import { SeriesBookTile } from "@/src/components";
import { useSeriesWithBooks } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { HeaderButton } from "./HeaderButton";

type BooksInSeriesProps = {
  seriesId: string;
  session: Session;
};

export function BooksInSeries({ seriesId, session }: BooksInSeriesProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { series } = useSeriesWithBooks(session, seriesId);

  if (!series) return null;

  const navigateToSeries = () => {
    router.navigate({
      pathname: "/series/[id]",
      params: { id: series.id, title: series.name },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={series.name}
          onPress={navigateToSeries}
          showCaret={series.seriesBooks.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
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
