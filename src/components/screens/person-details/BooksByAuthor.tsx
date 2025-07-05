import { BookTile, FadeInOnMount, HeaderButton } from "@/src/components";
import {
  BooksByAuthorsType,
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
    getBooksByAuthors(session, person.authors),
  );

  if (!authors) return null;

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
  author: BooksByAuthorsType[number];
  personName: string;
};

function BooksByAuthor(props: BooksByAuthorProps) {
  const { author, personName } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  if (author.books.length === 0) return null;

  const navigateToAuthor = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.id, title: author.name },
    });
  };

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
