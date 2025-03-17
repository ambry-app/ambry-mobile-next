import { BookTile } from "@/src/components";
import { useOtherBooksByAuthor } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "./HeaderButton";

type OtherBooksByAuthorProps = {
  authorId: string;
  session: Session;
  withoutBookId: string;
  withoutSeriesIds: string[];
};

export default function OtherBooksByAuthor(props: OtherBooksByAuthorProps) {
  const { authorId, session, withoutBookId, withoutSeriesIds } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { books, author, opacity } = useOtherBooksByAuthor(
    session,
    authorId,
    withoutBookId,
    withoutSeriesIds,
  );

  if (!author) return null;
  if (books.length === 0) return null;

  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: author.person.id, title: author.person.name },
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label={`More by ${author.name}`}
          onPress={navigateToPerson}
          showCaret={books.length == 10}
        />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={books}
        keyExtractor={(item) => item.id}
        horizontal={true}
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
    </Animated.View>
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
