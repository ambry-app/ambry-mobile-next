import { MediaTile } from "@/src/components";
import { useNarratorWithOtherMedia } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { HeaderButton } from "./HeaderButton";

type OtherMediaByNarratorProps = {
  narratorId: string;
  session: Session;
  withoutMediaId: string;
  withoutSeriesIds: string[];
  withoutAuthorIds: string[];
};

export function OtherMediaByNarrator(props: OtherMediaByNarratorProps) {
  const {
    narratorId,
    session,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { narrator } = useNarratorWithOtherMedia(
    session,
    narratorId,
    withoutMediaId,
    withoutSeriesIds,
    withoutAuthorIds,
  );

  if (!narrator) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: narrator.person.id, title: narrator.person.name },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More read by ${narrator.name}`}
          onPress={navigateToPerson}
          showCaret={narrator.media.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        data={narrator.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
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
