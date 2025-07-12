import {
  BookTile,
  FadeInOnMount,
  HeaderButton,
  SeeAllTile,
} from "@/src/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/src/constants";
import {
  AuthorWithOtherBooks,
  getOtherBooksByAuthors,
  MediaHeaderInfo,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

type OtherBooksByAuthorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherBooksByAuthors(props: OtherBooksByAuthorsProps) {
  const { media, session } = props;
  const authors = useLibraryData(() =>
    getOtherBooksByAuthors(session, media.book, HORIZONTAL_LIST_LIMIT),
  );

  if (!authors) return null;
  if (authors.length === 0) return null;

  return (
    <>
      {authors.map((author) => (
        <OtherBooksByAuthor key={`books-${author.id}`} author={author} />
      ))}
    </>
  );
}

type OtherBooksByAuthorProps = {
  author: AuthorWithOtherBooks;
};

function OtherBooksByAuthor(props: OtherBooksByAuthorProps) {
  const { author } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  if (author.books.length === 0) return null;

  const navigateToAuthor = () => {
    router.navigate({
      pathname: "/author/[id]",
      params: { id: author.id, title: author.name },
    });
  };

  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;
  const hasMore = author.books.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More by ${author.name}`}
          onPress={navigateToAuthor}
          showCaret={hasMore}
        />
      </View>
      <FlatList
        style={styles.list}
        data={author.books}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={tileSize + HORIZONTAL_TILE_SPACING}
        ListHeaderComponent={<View style={styles.listHeader} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToAuthor}
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
              <BookTile book={item} />
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
