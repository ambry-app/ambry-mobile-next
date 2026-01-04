import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import {
  FadeInOnMount,
  HeaderButton,
  PlaythroughTile,
  SeeAllTile,
  TimeAgo,
} from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import { getPlaythroughsPage } from "@/services/library-service";
import { useLibraryData } from "@/services/library-service";
import { useDataVersion } from "@/stores/data-version";
import { usePlayerUIState } from "@/stores/player-ui-state";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

type RecentInProgressProps = {
  session: Session;
};

export function RecentInProgress({ session }: RecentInProgressProps) {
  const loadedPlaythroughId = usePlayerUIState(
    (state) => state.loadedPlaythrough?.playthroughId,
  );
  const screenWidth = useScreen((state) => state.screenWidth);
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );
  const playthroughs = useLibraryData(
    () =>
      getPlaythroughsPage(
        session,
        HORIZONTAL_LIST_LIMIT,
        "in_progress",
        loadedPlaythroughId,
      ),
    [loadedPlaythroughId, playthroughVersion],
  );

  if (!playthroughs) return null;
  if (playthroughs.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(home)/(shelf)/in-progress",
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = playthroughs.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="In Progress"
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
            {item.lastListenedAt && <TimeAgo date={item.lastListenedAt} />}
            <PlaythroughTile playthrough={item} />
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
