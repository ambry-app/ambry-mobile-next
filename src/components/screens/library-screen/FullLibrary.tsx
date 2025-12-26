import { useMemo } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { Loading, MediaTile } from "@/components";
import { PAGE_SIZE } from "@/constants";
import { getMediaPage } from "@/db/library";
import { usePaginatedLibraryData } from "@/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useScreen } from "@/stores/screen";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

// FlatList layout constants for 2-column grid
const FLATLIST_PADDING = 8;
const TILE_PADDING = 8;
const TILE_MARGIN_BOTTOM = 8;
const TILE_GAP = 12; // gap between image and text in Tile component
const TEXT_HEIGHT = 46; // approximate height for 3 lines of text (title, author, narrator)
const NUM_COLUMNS = 2;

type FullLibraryProps = {
  session: Session;
};

export function FullLibrary({ session }: FullLibraryProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getMediaPage(session, pageSize, cursor);
  const getCursor = (item: { insertedAt: Date }) => item.insertedAt;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: media, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  // Calculate item height for getItemLayout optimization
  // Tile width = (screenWidth - flatlist padding) / numColumns
  // Image width = tile width - tile padding * 2
  // Image height = image width (square aspect ratio)
  // Total item height = image height + gap + text height + margin bottom
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
        Your library is empty. Log into the server on the web and add some
        audiobooks to get started!
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
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
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
