import { HeaderButton, MediaTile } from "@/src/components";
import { getBookOtherEditions, MediaHeaderInfo } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

type OtherEditionsProps = {
  media: MediaHeaderInfo;
  session: Session;
};

export function OtherEditions(props: OtherEditionsProps) {
  const { media, session } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const book = useLibraryData(() => getBookOtherEditions(session, media));

  if (!book) return null;
  if (!book.media[0]) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/book/[id]",
      params: {
        id: book.id,
        title: book.title,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Other Editions"
          onPress={navigateToBook}
          showCaret={book.media.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        data={book.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              media={{ ...item, book: book }}
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
