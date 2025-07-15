import {
  FadeInOnMount,
  HeaderButton,
  PlayerStateTile,
  SeeAllTile,
} from "@/src/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/src/constants";
import { getPlayerStatesPage } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePlayer } from "@/src/stores/player";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

type RecentInProgressProps = {
  session: Session;
};

export function RecentInProgress({ session }: RecentInProgressProps) {
  const mediaId = usePlayer((state) => state.mediaId);
  const screenWidth = useScreen((state) => state.screenWidth);
  const playerStates = useLibraryData(
    () =>
      getPlayerStatesPage(
        session,
        HORIZONTAL_LIST_LIMIT,
        "in_progress",
        mediaId,
      ),
    [mediaId],
  );

  if (!playerStates) return null;
  if (playerStates.length === 0) return null;

  const navigateToAll = () => {
    router.push({
      pathname: "/(tabs)/(shelf)/in-progress",
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = playerStates.length === HORIZONTAL_LIST_LIMIT;

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
        data={playerStates}
        keyExtractor={(item) => item.media.id}
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
            <PlayerStateTile playerState={item} session={session} />
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
