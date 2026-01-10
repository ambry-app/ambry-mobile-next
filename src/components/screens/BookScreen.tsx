import { FlatList, StyleSheet } from "react-native";

import { FadeInOnMount } from "@/components/FadeInOnMount";
import { Header } from "@/components/screens/book-screen/Header";
import { Tile } from "@/components/Tiles";
import { PAGE_SIZE } from "@/constants";
import { getBookDetails, useLibraryData } from "@/services/library-service";
import { Session } from "@/types/session";

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
