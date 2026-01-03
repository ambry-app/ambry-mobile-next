import { useMemo } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { MediaTile } from "@/components";
import { PAGE_SIZE } from "@/constants";
import { getSearchedMedia } from "@/services/library-service";
import { useLibraryData } from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { Colors } from "@/styles";
import { Session } from "@/types/session";

// FlatList layout constants for 2-column grid
const FLATLIST_PADDING = 8;
const TILE_PADDING = 8;
const TILE_MARGIN_BOTTOM = 8;
const TILE_GAP = 12;
const TEXT_HEIGHT = 46;
const NUM_COLUMNS = 2;

type SearchResultsProps = {
  session: Session;
  searchQuery: string;
};

export function SearchResults(props: SearchResultsProps) {
  const { session, searchQuery } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const media = useLibraryData(
    () => getSearchedMedia(session, PAGE_SIZE, searchQuery),
    [searchQuery],
  );

  const itemHeight = useMemo(() => {
    const contentWidth = screenWidth - FLATLIST_PADDING * 2;
    const tileWidth = contentWidth / NUM_COLUMNS;
    const imageWidth = tileWidth - TILE_PADDING * 2;
    return imageWidth + TILE_GAP + TEXT_HEIGHT + TILE_MARGIN_BOTTOM;
  }, [screenWidth]);

  const getItemLayout = useMemo(
    () => (_data: unknown, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight],
  );

  if (!media) {
    return null;
  }

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        Nothing in the library matches your search term. Please try another
        search.
      </Text>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      renderItem={({ item }) => (
        <View style={styles.tile}>
          <MediaTile media={item} />
        </View>
      )}
      getItemLayout={getItemLayout}
      removeClippedSubviews={Platform.OS === "android"}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
