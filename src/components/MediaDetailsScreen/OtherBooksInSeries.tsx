import { SeriesBookTile } from "@/src/components";
import { useOtherBooksInSeries } from "@/src/db/library_old";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "./HeaderButton";

type OtherBooksInSeriesProps = {
  seriesId: string;
  session: Session;
};

export default function OtherBooksInSeries({
  seriesId,
  session,
}: OtherBooksInSeriesProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { series, opacity } = useOtherBooksInSeries(session, seriesId);

  if (!series) return null;

  const navigateToSeries = () => {
    router.navigate({
      pathname: "/series/[id]",
      params: { id: series.id, title: series.name },
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={series.name}
          onPress={navigateToSeries}
          showCaret={series.seriesBooks.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
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
    </Animated.View>
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
