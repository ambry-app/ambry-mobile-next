import Loading from "@/src/components/Loading";
import ScreenCentered from "@/src/components/ScreenCentered";
import { MediaTile } from "@/src/components/Tiles";
import { useMediaList } from "@/src/db/library";
import { useLastDownSync } from "@/src/db/sync";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import colors from "tailwindcss/colors";

export default function LibraryScreen() {
  const session = useSession((state) => state.session);
  useSyncOnFocus();

  if (!session) return null;

  return <LibraryFlatlist session={session} />;
}

type LibraryFlatlistProps = {
  session: Session;
};

function LibraryFlatlist({ session }: LibraryFlatlistProps) {
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
    color: colors.zinc[100],
  },
  flatlist: {
    padding: 8,
  },
  tile: {
    padding: 8,
    width: "50%",
    marginBottom: 8,
  },
  error: {
    color: colors.red[500],
  },
});
