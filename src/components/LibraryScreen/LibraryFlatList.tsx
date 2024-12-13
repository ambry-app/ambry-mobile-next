import { Loading, MediaTile, ScreenCentered } from "@/src/components";
import { useMediaList } from "@/src/db/library";
import { useLastDownSync } from "@/src/db/sync";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";

type LibraryFlatlistProps = {
  session: Session;
};

export default function LibraryFlatlist({ session }: LibraryFlatlistProps) {
  const { media, updatedAt, opacity } = useMediaList(session);
  const lastDownSync = useLastDownSync(session);

  if (!lastDownSync || !updatedAt) {
    return (
      <ScreenCentered>
        <Loading />
      </ScreenCentered>
    );
  }

  if (updatedAt && lastDownSync && media.length === 0) {
    return (
      <ScreenCentered>
        <Text style={styles.text}>
          Your library is empty. Log into the server on the web and add some
          audiobooks to get started!
        </Text>
      </ScreenCentered>
    );
  }

  return (
    <Animated.FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={[styles.flatlist, { opacity }]}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile style={styles.tile} media={item} />}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
});
