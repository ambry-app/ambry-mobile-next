import { MediaTile } from "@/src/components";
import { useMediaOtherEditions } from "@/src/db/library_old";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import HeaderButton from "./HeaderButton";

type OtherEditionsProps = {
  bookId: string;
  session: Session;
  withoutMediaId: string;
};

export default function OtherEditions(props: OtherEditionsProps) {
  const { bookId, session, withoutMediaId } = props;
  const screenWidth = useScreen((state) => state.screenWidth);
  const { media, opacity } = useMediaOtherEditions(
    session,
    bookId,
    withoutMediaId,
  );

  if (media.length === 0) return null;

  const navigateToBook = () => {
    router.navigate({
      pathname: "/book/[id]",
      params: { id: media[0].book.id, title: media[0].book.title },
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.headerContainer}>
        <HeaderButton
          label="Other Editions"
          onPress={navigateToBook}
          showCaret={media.length === 10}
        />
      </View>
      <FlatList
        style={styles.list}
        showsHorizontalScrollIndicator={false}
        data={media}
        keyExtractor={(item) => item.id}
        horizontal={true}
        ListHeaderComponent={<View style={styles.listSpacer} />}
        renderItem={({ item }) => {
          return (
            <MediaTile
              style={[styles.tile, { width: screenWidth / 2.5 }]}
              media={item}
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
