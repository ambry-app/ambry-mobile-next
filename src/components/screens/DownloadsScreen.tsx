import { FlatList, StyleSheet, Text } from "react-native";

import { useDownloadedMedia } from "@/hooks/use-downloaded-media";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

import { DownloadRow } from "./downloads-screen";

export function DownloadsScreen({ session }: { session: Session }) {
  const media = useDownloadedMedia(session);
  const { refreshing, onRefresh } = usePullToRefresh(session);

  if (!media) return null;

  if (media.length === 0) {
    return (
      <Text style={styles.text}>
        You have no downloaded audiobooks. Visit the library to download some!
      </Text>
    );
  }

  return (
    <FlatList
      data={media}
      keyExtractor={(media) => media.id}
      renderItem={({ item }) => <DownloadRow media={item} session={session} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: Colors.zinc[100],
    paddingHorizontal: 32,
    paddingTop: 32,
  },
});
