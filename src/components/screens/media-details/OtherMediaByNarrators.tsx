import {
  FadeInOnMount,
  HeaderButton,
  MediaTile,
  SeeAllTile,
} from "@/src/components";
import {
  getOtherMediaByNarrators,
  MediaHeaderInfo,
  NarratorWithOtherMedia,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

const LIMIT = 10;

type OtherMediaByNarratorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherMediaByNarrators(props: OtherMediaByNarratorsProps) {
  const { media, session } = props;
  const narrators = useLibraryData(() =>
    getOtherMediaByNarrators(session, media, LIMIT),
  );

  if (!narrators) return null;
  if (narrators.length === 0) return null;

  return (
    <FadeInOnMount>
      {narrators.map((narrator) => (
        <OtherMediaByNarrator
          key={`media-${narrator.id}`}
          narrator={narrator}
        />
      ))}
    </FadeInOnMount>
  );
}

type OtherMediaByNarratorProps = {
  narrator: NarratorWithOtherMedia;
};

function OtherMediaByNarrator(props: OtherMediaByNarratorProps) {
  const { narrator } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  if (narrator.media.length === 0) return null;

  const navigateToNarrator = () => {
    router.navigate({
      pathname: "/narrator/[id]",
      params: { id: narrator.id, title: narrator.name },
    });
  };

  const hasMore = narrator.media.length === LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More read by ${narrator.name}`}
          onPress={navigateToNarrator}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={narrator.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToNarrator}
              style={{ width: screenWidth / 2.5, height: screenWidth / 2.5 }}
            />
          ) : null
        }
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
