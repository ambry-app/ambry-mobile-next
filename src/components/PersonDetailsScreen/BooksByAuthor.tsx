import { BookTile } from "@/src/components/Tiles";
import { useBooksByAuthor } from "@/src/db/library";
import { Session } from "@/src/stores/session";
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
    <Animated.View style={[styles.spacingTop, { opacity }]}>
      <Text
        className="mb-2 text-2xl font-medium text-zinc-100"
        numberOfLines={1}
      >
        {author.name === author.person.name
          ? `By ${author.name}`
          : `As ${author.name}`}
      </Text>

      <FlatList
        className="-mx-2"
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
  spacingTop: {
    marginTop: 32,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
