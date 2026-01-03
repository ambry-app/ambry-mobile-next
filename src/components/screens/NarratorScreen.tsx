import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  FadeInOnMount,
  Loading,
  MediaTile,
  ThumbnailImage,
} from "@/components";
import { PAGE_SIZE } from "@/constants";
import {
  getMediaByNarratorPage,
  getNarratorHeaderInfo,
  NarratorHeaderInfo,
} from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { usePaginatedLibraryData } from "@/hooks/use-paginated-library-data";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Colors } from "@/styles";
import { Session } from "@/types/session";

type NarratorScreenProps = {
  narratorId: string;
  session: Session;
};

export function NarratorScreen({ session, narratorId }: NarratorScreenProps) {
  const narrator = useLibraryData(() =>
    getNarratorHeaderInfo(session, narratorId),
  );
  const getPage = (pageSize: number, cursor: Date | undefined) =>
    getMediaByNarratorPage(session, narratorId, pageSize, cursor);
  const getCursor = (item: { published: Date }) => item.published;
  const page = usePaginatedLibraryData(PAGE_SIZE, getPage, getCursor);
  const { items: media, hasMore, loadMore } = page;
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!media || !narrator) {
    return null;
  }

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        This narrator has no audiobooks. How did you get here?
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
      ListHeaderComponent={
        <FadeInOnMount>
          <NarratorHeader narrator={narrator} />
        </FadeInOnMount>
      }
      ListFooterComponent={
        hasMore ? (
          <Loading style={{ paddingBottom: 128, paddingTop: 96 }} />
        ) : null
      }
    />
  );
}

type NarratorHeaderProps = {
  narrator: NarratorHeaderInfo;
};

function NarratorHeader({ narrator }: NarratorHeaderProps) {
  const navigateToPerson = () => {
    router.navigate({
      pathname: "/person/[id]",
      params: { id: narrator.person.id, title: narrator.person.name },
    });
  };

  return (
    <TouchableOpacity style={styles.headerContainer} onPress={navigateToPerson}>
      <ThumbnailImage
        thumbnails={narrator.person.thumbnails}
        size="medium"
        style={styles.thumbnail}
      />
      {narrator.name !== narrator.person.name ? (
        <View>
          <Text style={styles.headerText}>Read by {narrator.person.name}</Text>
          <Text style={styles.headerSubText}>Narrating as {narrator.name}</Text>
        </View>
      ) : (
        <Text style={styles.headerText}>Read by {narrator.name}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    padding: 8,
    marginBottom: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  headerSubText: {
    fontSize: 20,
    color: Colors.zinc[200],
  },
  thumbnail: {
    aspectRatio: 1,
    borderRadius: 9999,
    width: 64,
  },
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
