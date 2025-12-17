import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import {
  FadeInOnMount,
  HeaderButton,
  MediaTile,
  SeeAllTile,
  TimeAgo,
} from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import { getPlaythroughsPage } from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { useDataVersion } from "@/stores/data-version";
import { useScreen } from "@/stores/screen";
import { Session } from "@/stores/session";

type RecentlyFinishedProps = {
  session: Session;
};

export function RecentlyFinished({ session }: RecentlyFinishedProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );
  const playthroughs = useLibraryData(
    () => getPlaythroughsPage(session, HORIZONTAL_LIST_LIMIT, "finished"),
    [playthroughVersion],
  );

  if (!playthroughs) return null;
  if (playthroughs.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(home)/(shelf)/finished",
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = playthroughs.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Finished"
          onPress={navigateToAll}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={playthroughs}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
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
          <FadeInOnMount style={[styles.tile, { width: tileSize }]}>
            {item.finishedAt && <TimeAgo date={item.finishedAt} />}
            <MediaTile media={item.media} />
          </FadeInOnMount>
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
