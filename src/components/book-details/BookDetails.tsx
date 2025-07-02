import { Tile } from "@/src/components";
import { Session } from "@/src/stores/session";
import { FlatList, StyleSheet } from "react-native";
import { Header } from "./components";
import { useBookDetails } from "@/src/hooks/library";

type BookDetailsProps = {
  bookId: string;
  session: Session;
};

export function BookDetails({ bookId, session }: BookDetailsProps) {
  const { book } = useBookDetails(session, bookId);

  if (!book) return null;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
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
