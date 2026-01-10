import { useMemo } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { MediaTile } from "@/components/Tiles";
import { PAGE_SIZE, PLAYER_HEIGHT, TAB_BAR_BASE_HEIGHT } from "@/constants";
import { getSearchedMedia, useLibraryData } from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles/colors";
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

const MINI_PROGRESS_BAR_HEIGHT = 2;

export function SearchResults(props: SearchResultsProps) {
  const { session, searchQuery } = props;
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

  const animatedHeight = useSharedValue(keyboardHeight);
  animatedHeight.value = withTiming(keyboardHeight, { duration: 250 });

  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: animatedHeight.value,
  }));

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
      <Animated.View style={[styles.emptyContainer, animatedStyle]}>
        <FontAwesome6
          name="magnifying-glass"
          size={64}
          color={Colors.zinc[600]}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>No Results</Text>
        <Text style={styles.emptySubtitle}>
          Nothing in the library matches your search. Try a different search
          term.
        </Text>
      </Animated.View>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: keyboardHeight }}
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
