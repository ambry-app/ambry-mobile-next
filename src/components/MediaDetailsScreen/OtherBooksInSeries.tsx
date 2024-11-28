import HeaderButton from "@/src/components/MediaDetailsScreen/HeaderButton";
import { SeriesBookTile } from "@/src/components/Tiles";
import { useOtherBooksInSeries } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

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
      <HeaderButton label={series.name} onPress={navigateToSeries} />
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
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
  list: {
    paddingVertical: 8,
  },
  tile: {
    marginRight: 16,
  },
});
