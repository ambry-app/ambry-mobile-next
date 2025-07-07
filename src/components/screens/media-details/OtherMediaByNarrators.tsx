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
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/src/styles/constants";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

type OtherMediaByNarratorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherMediaByNarrators(props: OtherMediaByNarratorsProps) {
  const { media, session } = props;
  const narrators = useLibraryData(() =>
    getOtherMediaByNarrators(session, media, HORIZONTAL_LIST_LIMIT),
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
  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;

  if (narrator.media.length === 0) return null;

  const navigateToNarrator = () => {
    router.navigate({
      pathname: "/narrator/[id]",
      params: { id: narrator.id, title: narrator.name },
    });
  };

  const hasMore = narrator.media.length === HORIZONTAL_LIST_LIMIT;

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
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToNarrator}
              style={{
                width: tileSize,
                height: tileSize,
              }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: tileSize }]}
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
  listHeader: {
    width: 16,
  },
  tile: {
    marginRight: HORIZONTAL_TILE_SPACING,
  },
});
