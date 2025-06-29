import { MediaTile } from "@/src/components";
import { useBookOtherEditions } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import FadeInOnMount from "../FadeInOnMount";
import { HeaderButton } from "./HeaderButton";

type OtherEditionsProps = {
  bookId: string;
  session: Session;
  withoutMediaId: string;
};

export function OtherEditions(props: OtherEditionsProps) {
  const { bookId, session, withoutMediaId } = props;
  const screenWidth = useScreen((state) => state.screenWidth);

  const { bookWithOtherEditions } = useBookOtherEditions(
    session,
    bookId,
    withoutMediaId,
  );

  if (!bookWithOtherEditions) return null;
  if (!bookWithOtherEditions.media[0]) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/book/[id]",
      params: {
        id: bookWithOtherEditions.id,
        title: bookWithOtherEditions.title,
      },
    });
  };

  return (
    <FadeInOnMount style={styles.container}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Other Editions"
          onPress={navigateToBook}
          showCaret={bookWithOtherEditions.media.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={bookWithOtherEditions.media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        snapToInterval={screenWidth / 2.5 + 16}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              media={{ ...item, book: bookWithOtherEditions }}
            />
          );
        }}
      />
    </FadeInOnMount>
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
