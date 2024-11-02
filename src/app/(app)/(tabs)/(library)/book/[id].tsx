import NamesList from "@/src/components/NamesList";
import { Tile } from "@/src/components/Tiles";
import { BookDetails, useBookDetails } from "@/src/db/library";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { RouterParams } from "@/src/types/router";
import { formatPublished } from "@/src/utils/date";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

export default function BookDetailsScreen() {
  const session = useSession((state) => state.session);
  const { id: bookId, title } = useLocalSearchParams<RouterParams>();
  useSyncOnFocus();

  if (!session) return null;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <BookDetailsFlatList session={session} bookId={bookId} />
    </>
  );
}

type BookDetailsFlatListProps = {
  bookId: string;
  session: Session;
};

function BookDetailsFlatList({ bookId, session }: BookDetailsFlatListProps) {
  const { data: book, opacity } = useBookDetails(session, bookId);

  if (!book) return null;

  return (
    <Animated.FlatList
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

type BookProp = BookDetails;
type HeaderProps = { book: BookProp };

function Header({ book }: HeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View>
        <NamesList
          style={styles.headerAuthorsList}
          prefix="By"
          names={book.bookAuthors.map((ba) => ba.author.name)}
        />
        {book.published && (
          <Text style={styles.headerPublishedText}>
            First published{" "}
            {formatPublished(book.published, book.publishedFormat)}
          </Text>
        )}
      </View>
      <Text style={styles.headerEditionsText} numberOfLines={1}>
        Editions
      </Text>
    </View>
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
  headerContainer: {
    padding: 8,
    gap: 32,
  },
  headerAuthorsList: {
    fontSize: 18,
    fontWeight: 500,
    color: colors.zinc[100],
  },
  headerPublishedText: {
    color: colors.zinc[300],
  },
  headerEditionsText: {
    fontSize: 22,
    fontWeight: 500,
    color: colors.zinc[100],
  },
});
