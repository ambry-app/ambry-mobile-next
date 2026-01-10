import { FlatList, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { useDownloadedMedia } from "@/services/library-service";
import { usePullToRefresh } from "@/services/sync-service";
import { Colors } from "@/styles/colors";
import { Session } from "@/types/session";

import { DownloadRow } from "./downloads-screen/DownloadRow";

export function DownloadsScreen({ session }: { session: Session }) {
  const media = useDownloadedMedia(session);
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!media) return null;

  if (media.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome6
          name="download"
          size={64}
          color={Colors.zinc[600]}
          style={styles.icon}
        />
        <Text style={styles.emptyTitle}>No Downloads</Text>
        <Text style={styles.emptySubtitle}>
          Downloaded audiobooks will appear here for offline listening. Go to
          the Library ({" "}
          <FontAwesome6 name="book-open" size={14} color={Colors.zinc[400]} />{" "}
          ), tap on an audiobook, and find the download ({" "}
          <FontAwesome6 name="download" size={14} color={Colors.zinc[400]} /> )
          button to download.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={media}
      keyExtractor={(media) => media.id}
      renderItem={({ item }) => <DownloadRow media={item} session={session} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  icon: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.zinc[100],
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.zinc[400],
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
