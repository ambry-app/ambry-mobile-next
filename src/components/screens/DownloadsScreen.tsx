import { FadeInOnMount } from "@/src/components";
import { useDownloadedMedia } from "@/src/hooks/use-downloaded-media";
import { usePullToRefresh } from "@/src/hooks/use-pull-to-refresh";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { FlatList, StyleSheet, Text } from "react-native";
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
      renderItem={({ item }) => (
        <FadeInOnMount>
          <DownloadRow media={item} />
        </FadeInOnMount>
      )}
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
