import { MediaTile } from "@/src/components/Tiles";
import { useMediaList } from "@/src/db/library";
import useSyncOnFocus from "@/src/hooks/use.sync.on.focus";
import { Session, useSession } from "@/src/stores/session";
import { StyleSheet } from "react-native";
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
  const { data: media, updatedAt, opacity } = useMediaList(session);

  if (updatedAt !== undefined && media.length === 0) {
    // TODO: there are no books on this server
    return null;
  }

  return (
    <Animated.FlatList
      style={[styles.flatlist, { opacity }]}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <MediaTile style={styles.tile} media={item} />}
    />
  );
}

const styles = StyleSheet.create({
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
