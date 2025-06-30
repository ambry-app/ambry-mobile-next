import { Tile } from "@/src/components";
import { useBookDetails } from "@/src/db/library_old";
import { Session } from "@/src/stores/session";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import Header from "./Header";

type BookDetailsFlatListProps = {
  bookId: string;
  session: Session;
};

export default function BookDetailsFlatList({
  bookId,
  session,
}: BookDetailsFlatListProps) {
  const { book, opacity } = useBookDetails(session, bookId);

  if (!book) return null;

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.container, { opacity }]}
      data={book.media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      ListHeaderComponent={() => <Header book={book} />}
      renderItem={({ item }) => {
        return <Tile style={styles.tile} media={[item]} book={book} />;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
