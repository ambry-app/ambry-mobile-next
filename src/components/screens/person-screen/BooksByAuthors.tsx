import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import {
  BookTile,
  FadeInOnMount,
  HeaderButton,
  SeeAllTile,
} from "@/components";
import {
  HORIZONTAL_LIST_LIMIT,
  HORIZONTAL_TILE_SPACING,
  HORIZONTAL_TILE_WIDTH_RATIO,
} from "@/constants";
import {
  AuthorWithBooks,
  getBooksByAuthors,
  PersonHeaderInfo,
} from "@/services/library-service";
import { useLibraryData } from "@/services/library-service";
import { useScreen } from "@/stores/screen";
import { Session } from "@/types/session";

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
    <>
      {authors.map((author) => (
        <BooksByAuthor
          key={`books-${author.id}`}
          author={author}
          personName={person.name}
        />
      ))}
    </>
  );
}

type BooksByAuthorProps = {
  author: AuthorWithBooks;
  personName: string;
};

function BooksByAuthor(props: BooksByAuthorProps) {
  const { author, personName } = props;
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
      <FadeInOnMount style={styles.headerContainer}>
        <HeaderButton
          label={
            author.name === personName
              ? `By ${author.name}`
              : `As ${author.name}`
          }
          onPress={navigateToAuthor}
          showCaret={hasMore}
        />
      </FadeInOnMount>

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
