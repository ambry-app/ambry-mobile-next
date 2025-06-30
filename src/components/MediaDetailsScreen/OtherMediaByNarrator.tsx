import { MediaTile } from "@/src/components";
import { useOtherMediaByNarrator } from "@/src/db/library_old";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "./HeaderButton";

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
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More by ${narrator.name}`}
          onPress={navigateToPerson}
          showCaret={media.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              media={item}
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
