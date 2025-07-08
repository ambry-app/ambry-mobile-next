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
  AuthorWithBooks,
  getBooksByAuthors,
  PersonHeaderInfo,
} from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

type BooksByAuthorsProps = {
  person: PersonHeaderInfo;
  session: Session;
};

export function BooksByAuthors(props: BooksByAuthorsProps) {
  const { person, session } = props;
  const authors = useLibraryData(() =>
    getBooksByAuthors(session, person.authors, HORIZONTAL_LIST_LIMIT),
  );

  if (!authors) return null;
  if (authors.length === 0) return null;

  return (
    <FadeInOnMount>
      {authors.map((author) => (
        <BooksByAuthor
          key={`books-${author.id}`}
          author={author}
          personName={person.name}
        />
      ))}
    </FadeInOnMount>
  );
}

type BooksByAuthorProps = {
  author: AuthorWithBooks;
  personName: string;
};

function BooksByAuthor(props: BooksByAuthorProps) {
  const { author, personName } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const tileSize = screenWidth / HORIZONTAL_TILE_WIDTH_RATIO;

  if (author.books.length === 0) return null;

  const navigateToAuthor = () => {
    router.navigate({
      pathname: "/author/[id]",
      params: { id: author.id, title: author.name },
    });
  };

  const hasMore = author.books.length === HORIZONTAL_LIST_LIMIT;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={
            author.name === personName
              ? `By ${author.name}`
              : `As ${author.name}`
          }
          onPress={navigateToAuthor}
          showCaret={hasMore}
        />
      </View>

      <FlatList
        style={styles.list}
        data={author.books}
        keyExtractor={(item) => item.id}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
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
            <BookTile style={[styles.tile, { width: tileSize }]} book={item} />
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
