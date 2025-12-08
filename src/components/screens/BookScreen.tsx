import { FlatList, StyleSheet } from "react-native";

import { FadeInOnMount, Tile } from "@/components";
import { Header } from "@/components/screens/book-screen";
import { PAGE_SIZE } from "@/constants";
import { getBookDetails } from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { Session } from "@/stores/session";

type BookScreenProps = {
  bookId: string;
  session: Session;
};

// NOTE: Media is hard-limited to PAGE_SIZE. This could be a paginated list,
// but it seems really unlikely that a book will have that many media.
export function BookScreen({ bookId, session }: BookScreenProps) {
  const book = useLibraryData(() => getBookDetails(session, bookId, PAGE_SIZE));

  if (!book) return null;

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      data={book.media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      ListHeaderComponent={() => (
        <FadeInOnMount>
          <Header book={book} />
        </FadeInOnMount>
      )}
      renderItem={({ item }) => {
        return (
          <FadeInOnMount style={styles.tile}>
            <Tile media={[item]} book={book} />
          </FadeInOnMount>
        );
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
