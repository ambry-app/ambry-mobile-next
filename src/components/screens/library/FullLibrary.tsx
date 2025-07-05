import { FadeInOnMount, Loading, MediaTile } from "@/src/components";
import { useMediaPages } from "@/src/hooks/library";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";

type FullLibraryProps = {
  session: Session;
};

export function FullLibrary({ session }: FullLibraryProps) {
  const { media, hasMore, loadMore } = useMediaPages(session);
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!media) {
    return null;
  }

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        Your library is empty. Log into the server on the web and add some
        audiobooks to get started!
      </Text>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={styles.flatlist}
      data={media}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <FadeInOnMount style={styles.tile}>
          <MediaTile media={item} />
        </FadeInOnMount>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
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
