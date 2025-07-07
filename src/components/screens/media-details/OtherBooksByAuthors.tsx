import {
  BookTile,
  FadeInOnMount,
  HeaderButton,
  SeeAllTile,
} from "@/src/components";
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

const LIMIT = 10;

type OtherBooksByAuthorsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherBooksByAuthors(props: OtherBooksByAuthorsProps) {
  const { media, session } = props;
  const authors = useLibraryData(() =>
    getOtherBooksByAuthors(session, media.book, LIMIT),
  );

  if (!authors) return null;
  if (authors.length === 0) return null;

  return (
    <FadeInOnMount>
      {authors.map((author) => (
        <OtherBooksByAuthor key={`books-${author.id}`} author={author} />
      ))}
    </FadeInOnMount>
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

  const hasMore = author.books.length === LIMIT;

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
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        ListFooterComponent={
          hasMore ? (
            <SeeAllTile
              onPress={navigateToAuthor}
              style={{ width: screenWidth / 2.5, height: screenWidth / 2.5 }}
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <BookTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              book={item}
            />
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
  listSpacer: {
    width: 16,
  },
  tile: {
    marginRight: 16,
  },
});
