import { BookTile, FadeInOnMount } from "@/src/components";
import { PersonWithAuthoredBooks } from "@/src/db/library";
import { usePersonWithAuthoredBooks } from "@/src/hooks/library/use-person-with-authored-books";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text, View } from "react-native";

type BooksByAuthorsProps = {
  personId: string;
  session: Session;
};

export function BooksByAuthors({ personId, session }: BooksByAuthorsProps) {
  const { person } = usePersonWithAuthoredBooks(session, personId);

  if (!person) return null;

  return (
    <FadeInOnMount>
      {person.authors.map((author) => (
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
  author: PersonWithAuthoredBooks["authors"][0];
  personName: string;
};

function BooksByAuthor(props: BooksByAuthorProps) {
  const { author, personName } = props;

  if (author.books.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header} numberOfLines={1}>
        {author.name === personName ? `By ${author.name}` : `As ${author.name}`}
      </Text>

      <FlatList
        style={styles.list}
        data={author.books}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <BookTile style={styles.tile} book={item} />;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  list: {
    marginHorizontal: -8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
