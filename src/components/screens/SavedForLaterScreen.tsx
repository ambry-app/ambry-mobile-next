import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { Loading } from "@/components/Loading";
import { MediaTile } from "@/components/Tiles";
import { TimeAgo } from "@/components/TimeAgo";
import { PAGE_SIZE } from "@/constants";
import { usePaginatedLibraryData } from "@/services/library-service";
import { getSavedMediaPage } from "@/services/shelf-service";
import { usePullToRefresh } from "@/services/sync-service";
import { useDataVersion } from "@/stores/data-version";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

type SavedForLaterScreenProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
};

export function SavedForLaterScreen({
  session,
  scrollHandler,
}: SavedForLaterScreenProps) {
  const shelfDataVersion = useDataVersion((state) => state.shelfDataVersion);
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getSavedMediaPage(session, pageSize, cursor);
  const getCursor = (item: { addedAt: Date }) => item.addedAt;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor, [
    shelfDataVersion,
  ]);
  const { items: savedMedia, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!savedMedia) return null;

  if (savedMedia.length === 0) {
    return <Text style={styles.text}>You have no saved audiobooks!</Text>;
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      data={savedMedia}
      keyExtractor={(item) => item.media.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <TimeAgo date={item.addedAt} prefix="saved" />
          <MediaTile media={item.media} />
        </FadeInOnMount>
      )}
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
