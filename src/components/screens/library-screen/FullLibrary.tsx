import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { ScrollHandler } from "@/components/FadingHeader";
import { Loading } from "@/components/Loading";
import { MediaTile } from "@/components/Tiles";
import { PAGE_SIZE, PLAYER_HEIGHT, TAB_BAR_BASE_HEIGHT } from "@/constants";
import {
  getMediaPage,
  usePaginatedLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { useScreen } from "@/stores/screen";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

// FlatList layout constants for 2-column grid
const FLATLIST_PADDING = 8;
const TILE_PADDING = 8;
const TILE_MARGIN_BOTTOM = 8;
const TILE_GAP = 12; // gap between image and text in Tile component
const TEXT_HEIGHT = 46; // approximate height for 3 lines of text (title, author, narrator)
const NUM_COLUMNS = 2;

type FullLibraryProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
  topInset?: number;
};

const MINI_PROGRESS_BAR_HEIGHT = 2;

export function FullLibrary({
  session,
  scrollHandler,
  topInset = 0,
}: FullLibraryProps) {
  const screenWidth = useScreen((state) => state.screenWidth);
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const playerLoaded = useTrackPlayer((state) => !!state.playthrough);

  // Calculate the height of the bottom bar (tab bar + player if loaded)
  const bottomBarHeight =
    TAB_BAR_BASE_HEIGHT +
    safeAreaBottom +
    (playerLoaded ? PLAYER_HEIGHT + MINI_PROGRESS_BAR_HEIGHT : 0);

  // Keyboard height is from screen bottom, but content is above the bottom bar
  const rawKeyboardHeight = useKeyboardState((state) => state.height);
  const keyboardHeight = Math.max(0, rawKeyboardHeight - bottomBarHeight);

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
      <View
        style={[
          styles.emptyContainer,
          topInset > 0 && { paddingTop: topInset },
        ]}
      >
        <FontAwesome6
          name="book-open"
          size={64}
          color={Colors.zinc[600]}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>Your Library is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Log into your Ambry server on the web and add some audiobooks to get
          started.
        </Text>
      </View>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingBottom: keyboardHeight,
        paddingTop: topInset > 0 ? topInset : undefined,
      }}
      progressViewOffset={topInset}
      style={styles.flatlist}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.zinc[400],
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
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
