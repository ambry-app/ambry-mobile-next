import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { Loading } from "@/components/Loading";
import { MediaTile } from "@/components/Tiles";
import { PAGE_SIZE } from "@/constants";
import {
  getMediaByNarratorPage,
  NarratorHeaderInfo,
  usePaginatedLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

type NarratorScreenProps = {
  narratorId: string;
  session: Session;
  narrator: NarratorHeaderInfo | null;
  scrollHandler: ScrollHandler;
};

export function NarratorScreen({
  session,
  narratorId,
  narrator,
  scrollHandler,
}: NarratorScreenProps) {
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getMediaByNarratorPage(session, narratorId, pageSize, cursor);
  const getCursor = (item: { published: Date }) => item.published;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: media, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!media || !narrator) {
    return null;
  }

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        This narrator has no audiobooks. How did you get here?
      </Text>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      showsVerticalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <MediaTile media={item} />
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
