import {
  BookTile,
  FadeInOnMount,
  Loading,
  ThumbnailImage,
} from "@/src/components";
import { PAGE_SIZE } from "@/src/constants";
import {
  AuthorHeaderInfo,
  getAuthorHeaderInfo,
  getBooksByAuthorPage,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { usePaginatedLibraryData } from "@/src/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { router } from "expo-router";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type AuthorDetailsProps = {
  authorId: string;
  session: Session;
};

export function AuthorDetails({ session, authorId }: AuthorDetailsProps) {
  const author = useLibraryData(() => getAuthorHeaderInfo(session, authorId));
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
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
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
      ListHeaderComponent={
        <FadeInOnMount>
          <AuthorHeader author={author} />
        </FadeInOnMount>
      }
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
    />
  );
}

type AuthorHeaderProps = {
  author: AuthorHeaderInfo;
};

function AuthorHeader({ author }: AuthorHeaderProps) {
  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.person.id, title: author.person.name },
    });
  };

  return (
    <TouchableOpacity style={styles.headerContainer} onPress={navigateToPerson}>
      <ThumbnailImage
        thumbnails={author.person.thumbnails}
        size="medium"
        style={styles.thumbnail}
      />
      {author.name !== author.person.name ? (
        <View>
          <Text style={styles.headerText}>By {author.person.name}</Text>
          <Text style={styles.headerSubText}>writing as {author.name}</Text>
        </View>
      ) : (
        <Text style={styles.headerText}>By {author.name}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    padding: 8,
    marginBottom: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  headerSubText: {
    fontSize: 20,
    color: Colors.zinc[200],
  },
  thumbnail: {
    aspectRatio: 1,
    borderRadius: 9999,
    width: 64,
  },
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
