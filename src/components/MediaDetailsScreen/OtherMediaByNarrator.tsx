import HeaderButton from "@/src/components/MediaDetailsScreen/HeaderButton";
import { MediaTile } from "@/src/components/Tiles";
import { useOtherMediaByNarrator } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList } from "react-native";
import Animated from "react-native-reanimated";

type OtherMediaByNarratorProps = {
  narratorId: string;
  session: Session;
  withoutMediaId: string;
  withoutSeriesIds: string[];
  withoutAuthorIds: string[];
};

export default function OtherMediaByNarrator(props: OtherMediaByNarratorProps) {
  const {
    narratorId,
    session,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, narrator, opacity } = useOtherMediaByNarrator(
    session,
    narratorId,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  );

  if (!narrator) return null;
  if (media.length === 0) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: narrator.person.id, title: narrator.person.name },
    });
  };

  return (
    <Animated.View style={{ opacity }} className="mt-8">
      <HeaderButton
        label={`More by ${narrator.name}`}
        onPress={navigateToPerson}
      />
      <FlatList
        className="py-2"
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={{ width: screenWidth / 2.5, marginRight: 16 }}
              media={item}
            />
          );
        }}
      />
    </Animated.View>
  );
}
