import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { HeaderButton } from "@/components/HeaderButton";
import { MediaTile } from "@/components/Tiles";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import {
  getSetParts,
  MediaHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";
import { partLabel } from "@/utils/titles";

type PartsInSetProps = {
  media: MediaHeaderInfo;
  session: Session;
};

/**
 * The rest of the set this recording belongs to. A set covers one book across
 * several releases, so the parts share a title and are told apart by their
 * part label.
 */
export function PartsInSet(props: PartsInSetProps) {
  const { media, session } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const set = media.set;
  const parts = useLibraryData(
    async () =>
      set
        ? getSetParts(session, set.id, {
            excludeMediaId: media.id,
            limit: HORIZONTAL_LIST_LIMIT,
          })
        : null,
    [session, set?.id, media.id],
  );

  if (!set || !parts || parts.length === 0) return null;

  const navigateToSet = () => {
    router.navigate({
      pathname: "/set/[id]",
      params: { id: set.id, title: media.book.title },
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Rest of this set"
          onPress={navigateToSet}
          showCaret
        />
      </View>
      <FlatList
        style={styles.list}
        data={parts}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        ListHeaderComponent={<View style={styles.listHeader} />}
        renderItem={({ item }) => (
          <View style={[styles.tile, { width: tileSize }]}>
            <MediaTile
              media={{
                ...item,
                title:
                  item.title ??
                  partLabel(item.partNumber, set, { includeTotal: false }),
                book: { ...item.book, authors: [] },
              }}
            />
          </View>
        )}
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
