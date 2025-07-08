import { FadeInOnMount, Tile } from "@/src/components";
import { Header } from "@/src/components/screens/book-details";
import { PAGE_SIZE } from "@/src/constants";
import { getBookDetails } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { Session } from "@/src/stores/session";
import { FlatList, StyleSheet } from "react-native";

type BookDetailsProps = {
  bookId: string;
  session: Session;
};

// NOTE: Media is hard-limited to PAGE_SIZE. This could be a paginated list,
// but it seems really unlikely that a book will have that many media.
export function BookDetails({ bookId, session }: BookDetailsProps) {
  const book = useLibraryData(() => getBookDetails(session, bookId, PAGE_SIZE));

  if (!book) return null;

  return (
    <FadeInOnMount>
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
    </FadeInOnMount>
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
