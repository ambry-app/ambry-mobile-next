import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { HeaderButton, MediaTile, SeeAllTile, TimeAgo } from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import { getSavedMediaPage } from "@/db/shelves";
import { useLibraryData } from "@/hooks/use-library-data";
import { useDataVersion } from "@/stores/data-version";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

type SavedForLaterProps = {
  session: Session;
};

export function SavedForLater({ session }: SavedForLaterProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const shelfDataVersion = useDataVersion((state) => state.shelfDataVersion);
  const savedMedia = useLibraryData(
    () => getSavedMediaPage(session, HORIZONTAL_LIST_LIMIT),
    [shelfDataVersion],
  );

  if (!savedMedia) return null;
  if (savedMedia.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(home)/(shelf)/saved",
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = savedMedia.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Saved for Later"
          onPress={navigateToAll}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={savedMedia}
        keyExtractor={(item) => item.media.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        windowSize={3}
        initialNumToRender={4}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToAll}
              style={{ width: tileSize, height: tileSize }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.tile, { width: tileSize }]}>
            <TimeAgo date={item.addedAt} />
            <MediaTile media={item.media} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
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
