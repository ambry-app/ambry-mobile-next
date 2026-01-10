import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import {
  FadeInOnMount,
  HeaderButton,
  MediaTile,
  SeeAllTile,
} from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import {
  getBookOtherEditions,
  MediaHeaderInfo,
  useLibraryData,
} from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

type OtherEditionsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherEditions(props: OtherEditionsProps) {
  const { media, session } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const book = useLibraryData(() =>
    getBookOtherEditions(session, media, HORIZONTAL_LIST_LIMIT),
  );

  if (!book) return null;
  if (!book.media[0]) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/book/[id]",
      params: {
        id: book.id,
        title: book.title,
      },
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = book.media.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Other Editions"
          onPress={navigateToBook}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={book.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToBook}
              style={{
                width: tileSize,
                height: tileSize,
              }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <FadeInOnMount style={[styles.tile, { width: tileSize }]}>
              <MediaTile media={{ ...item, book: book }} />
            </FadeInOnMount>
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
