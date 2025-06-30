import { BookTile } from "@/src/components";
import { useAuthorWithOtherBooks } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { HeaderButton } from "./HeaderButton";

type OtherBooksByAuthorProps = {
  authorId: string;
  session: Session;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

export function OtherBooksByAuthor(props: OtherBooksByAuthorProps) {
  const { authorId, session, withoutBookId, withoutSeriesIds } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { author } = useAuthorWithOtherBooks(
    session,
    authorId,
    withoutBookId,
    withoutSeriesIds,
  );

  if (!author) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.person.id, title: author.person.name },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More by ${author.name}`}
          onPress={navigateToPerson}
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
