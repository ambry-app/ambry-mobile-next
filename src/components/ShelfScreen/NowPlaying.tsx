import { TileImage, TileText } from "@/src/components";
import { ProgressBar } from "@/src/components/Player";
import { useMediaDetails } from "@/src/db/library";
import { usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { StyleSheet, Text, View } from "react-native";

type NowPlayingProps = {
  session: Session;
};

export default function NowPlaying({ session }: NowPlayingProps) {
  const mediaId = usePlayer((state) => state.mediaId);

  if (!mediaId) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label} numberOfLines={1}>
        Now Playing
      </Text>
      <NowPlayingDetails session={session} mediaId={mediaId} />
    </View>
  );
}

type NowPlayingDetailsProps = {
  session: Session;
  mediaId: string;
};

function NowPlayingDetails({ session, mediaId }: NowPlayingDetailsProps) {
  const { media } = useMediaDetails(session, mediaId);

  if (!media) return null;

  return (
    <View style={styles.rowContainer}>
      <View style={styles.leftContainer}>
        <TileImage media={[media]} book={media.book} />
      </View>
      <View style={styles.rightContainer}>
        <TileText media={[media]} book={media.book} />
        <View style={styles.spacer} />
        <ProgressBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 8,
  },
  rowContainer: {
    display: "flex",
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  label: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.zinc[100],
  },
  leftContainer: {
    flex: 0.75,
  },
  rightContainer: {
    flex: 1.25,
    display: "flex",
  },
  spacer: {
    flexGrow: 1,
  },
});
