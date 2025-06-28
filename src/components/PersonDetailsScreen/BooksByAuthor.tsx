import { BookTile } from "@/src/components";
import { useBooksByAuthor } from "@/src/db/library_old";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

type BooksByAuthorProps = {
  authorId: string;
  session: Session;
};

export default function BooksByAuthor({
  authorId,
  session,
}: BooksByAuthorProps) {
  const { books, author, opacity } = useBooksByAuthor(session, authorId);

  if (!author) return null;
  if (books.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.header} numberOfLines={1}>
        {author.name === author.person.name
          ? `By ${author.name}`
          : `As ${author.name}`}
      </Text>

      <FlatList
        style={styles.list}
        data={books}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => {
          return <BookTile style={styles.tile} book={item} />;
        }}
      />
    </Animated.View>
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
