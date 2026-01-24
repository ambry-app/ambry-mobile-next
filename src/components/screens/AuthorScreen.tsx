import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { ScrollHandler } from "@/components/FadingHeader";
import { Loading } from "@/components/Loading";
import { BookTile } from "@/components/Tiles";
import { PAGE_SIZE } from "@/constants";
import {
  AuthorHeaderInfo,
  getBooksByAuthorPage,
  usePaginatedLibraryData,
} from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

type AuthorScreenProps = {
  authorId: string;
  session: Session;
  author: AuthorHeaderInfo | null;
  scrollHandler: ScrollHandler;
};

export function AuthorScreen({
  session,
  authorId,
  author,
  scrollHandler,
}: AuthorScreenProps) {
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getBooksByAuthorPage(session, authorId, pageSize, cursor);
  const getCursor = (item: { published: Date }) => item.published;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: books, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!books || !author) {
    return null;
  }

  if (books.length === 0) {
    return (
      <Text style={styles.text}>
        This author has no books. How did you get here?
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
      data={books}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <BookTile book={item} />
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
