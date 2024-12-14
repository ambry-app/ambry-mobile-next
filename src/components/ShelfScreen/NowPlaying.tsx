import { TileImage, TileText } from "@/src/components";
import { PlayerProgressBar } from "@/src/components/Player";
import { useMediaDetails } from "@/src/db/library";
import { requestExpandPlayer, usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

type NowPlayingProps = {
  session: Session;
};

export default function NowPlaying({ session }: NowPlayingProps) {
  const mediaId = usePlayer((state) => state.mediaId);

  if (!mediaId) return null;

  return <NowPlayingDetails session={session} mediaId={mediaId} />;
}

type NowPlayingDetailsProps = {
  session: Session;
  mediaId: string;
};

function NowPlayingDetails({ session, mediaId }: NowPlayingDetailsProps) {
  const { media, opacity } = useMediaDetails(session, mediaId);
  const expandPlayer = () => requestExpandPlayer();

  if (!media) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.label} numberOfLines={1}>
        Now Playing
      </Text>
      <View style={styles.rowContainer}>
        <View style={styles.leftContainer}>
          <TileImage media={[media]} book={media.book} onPress={expandPlayer} />
        </View>
        <View style={styles.rightContainer}>
          <TileText media={[media]} book={media.book} onPress={expandPlayer} />
          <View style={styles.spacer} />
          <PlayerProgressBar />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 12,
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
