import { ScreenCentered } from "@/src/components";
import { useDownloadsList } from "@/src/db/downloads";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import DownloadRow from "./DownloadRow";

export default function DownloadsFlatList({ session }: { session: Session }) {
  const { downloads, updatedAt, opacity } = useDownloadsList(session);

  if (updatedAt !== undefined && downloads.length === 0) {
    return (
      <ScreenCentered>
        <Text style={styles.noDownloadsText}>
          You have no downloaded audiobooks.
        </Text>
        <Text style={styles.noDownloadsText}>
          Go to the{" "}
          <Link href="/(tabs)/(library)" style={styles.noDownloadsLinkText}>
            library
          </Link>{" "}
          to download some!
        </Text>
      </ScreenCentered>
    );
  }

  return (
    <Animated.FlatList
      style={{ opacity }}
      data={downloads}
      keyExtractor={(download) => download.media.id}
      renderItem={({ item }) => <DownloadRow download={item} />}
    />
  );
}

const styles = StyleSheet.create({
  noDownloadsText: {
    color: Colors.zinc[100],
    fontSize: 18,
    textAlign: "center",
  },
  noDownloadsLinkText: {
    color: Colors.lime[400],
  },
});
