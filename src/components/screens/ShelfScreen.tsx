import { RefreshControl, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { ScrollHandler } from "@/components/FadingHeader";
import {
  getPlaythroughsPage,
  useLibraryData,
} from "@/services/library-service";
import { getSavedMediaPage } from "@/services/shelf-service";
import { usePullToRefresh } from "@/services/sync-service";
import { useDataVersion } from "@/stores/data-version";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

import { NowPlaying } from "./shelf-screen/NowPlaying";
import { RecentInProgress } from "./shelf-screen/RecentInProgress";
import { RecentlyFinished } from "./shelf-screen/RecentlyFinished";
import { SavedForLater } from "./shelf-screen/SavedForLater";

type ShelfScreenProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
  topInset?: number;
};

export function ShelfScreen(props: ShelfScreenProps) {
  const { session, scrollHandler, topInset = 0 } = props;
  const { refreshing, onRefresh } = usePullToRefresh(session);
  const isEmpty = useIsShelfEmpty(session);

  if (isEmpty) {
    return (
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.emptyContainer,
          topInset > 0 && { paddingTop: topInset },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={8}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={topInset}
          />
        }
      >
        <FontAwesome6
          name="bookmark"
          size={64}
          color={Colors.zinc[600]}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>Your Shelf is Empty</Text>
        <Text style={styles.emptySubtitle}>
          In-progress, finished, and saved audiobooks will appear here. Go to
          the Library ({" "}
          <FontAwesome6 name="book-open" size={14} color={Colors.zinc[400]} />{" "}
          ), tap on an audiobook, and tap play ({" "}
          <FontAwesome6 name="play" size={14} color={Colors.zinc[400]} /> ) to
          start listening.
        </Text>
      </Animated.ScrollView>
    );
  }

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.container,
        topInset > 0 && { paddingTop: topInset },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={8}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={topInset}
        />
      }
    >
      <NowPlaying session={session} />
      <RecentInProgress session={session} />
      <RecentlyFinished session={session} />
      <SavedForLater session={session} />
    </Animated.ScrollView>
  );
}

function useIsShelfEmpty(session: Session): boolean | undefined {
  const hasPlaythrough = useTrackPlayer((state) => !!state.playthrough);
  const playthroughVersion = useDataVersion(
    (state) => state.playthroughDataVersion,
  );
  const shelfVersion = useDataVersion((state) => state.shelfDataVersion);

  const inProgress = useLibraryData(
    () => getPlaythroughsPage(session, 1, "in_progress"),
    [playthroughVersion],
  );
  const finished = useLibraryData(
    () => getPlaythroughsPage(session, 1, "finished"),
    [playthroughVersion],
  );
  const saved = useLibraryData(
    () => getSavedMediaPage(session, 1),
    [shelfVersion],
  );

  // Still loading
  if (inProgress === undefined || finished === undefined || saved === undefined)
    return undefined;

  return (
    !hasPlaythrough &&
    inProgress.length === 0 &&
    finished.length === 0 &&
    saved.length === 0
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
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
});
