import HeaderButton from "@/src/components/MediaDetailsScreen/HeaderButton";
import { SeriesBookTile } from "@/src/components/Tiles";
import { useOtherBooksInSeries } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList } from "react-native";
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
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton label={series.name} onPress={navigateToSeries} />
      <FlatList
        className="py-2"
        data={series.seriesBooks}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <SeriesBookTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              seriesBook={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}
