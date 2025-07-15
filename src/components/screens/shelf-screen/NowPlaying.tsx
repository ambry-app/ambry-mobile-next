import {
  FadeInOnMount,
  PlayerProgressBar,
  TileImage,
  TileText,
} from "@/src/components";
import { getMedia } from "@/src/db/library";
import { useLibraryData } from "@/src/hooks/use-library-data";
import { requestExpandPlayer, usePlayer } from "@/src/stores/player";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { Pressable, StyleSheet, Text, View } from "react-native";

type NowPlayingProps = {
  session: Session;
};

export function NowPlaying({ session }: NowPlayingProps) {
  const mediaId = usePlayer((state) => state.mediaId);

  if (!mediaId) return null;

  return <NowPlayingDetails session={session} mediaId={mediaId} />;
}

type NowPlayingDetailsProps = {
  session: Session;
  mediaId: string;
};

function NowPlayingDetails({ session, mediaId }: NowPlayingDetailsProps) {
  const media = useLibraryData(() => getMedia(session, mediaId), [mediaId]);
  const expandPlayer = () => requestExpandPlayer();

  if (!media) return null;

  return (
    <FadeInOnMount style={styles.container}>
      <Text style={styles.label} numberOfLines={1}>
        Now Playing
      </Text>
      <Pressable onPress={expandPlayer}>
        <View style={styles.rowContainer}>
          <View style={styles.leftContainer}>
            <TileImage media={[media]} />
          </View>
          <View style={styles.rightContainer}>
            <TileText media={[media]} book={media.book} />
            <View style={styles.spacer} />
            <PlayerProgressBar />
          </View>
        </View>
      </Pressable>
    </FadeInOnMount>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
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
