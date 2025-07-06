import { BookTile, FadeInOnMount, HeaderButton } from "@/src/components";
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
    getOtherBooksByAuthors(session, media.book),
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

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.person.id, title: author.person.name },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More by ${author.name}`}
          onPress={navigateToPerson}
          showCaret={author.books.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        data={author.books}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
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
