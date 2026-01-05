import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerProgressBar, TileImage, TileText } from "@/components";
import { getMedia } from "@/services/library-service";
import { useLibraryData } from "@/services/library-service";
import { expandPlayer } from "@/services/playback-controls";
import { useTrackPlayer } from "@/stores/track-player";
import { Colors } from "@/styles";
import { Session } from "@/types/session";

type NowPlayingProps = {
  session: Session;
};

export function NowPlaying({ session }: NowPlayingProps) {
  const playthrough = useTrackPlayer((state) => state.playthrough);

  // Don't render when player is fully expanded (we're hidden behind it anyway)
  // collapsedPlayerVisible is false when fully expanded, true when collapsed or animating
  if (!playthrough) return null;

  return <NowPlayingDetails session={session} mediaId={playthrough.mediaId} />;
}

type NowPlayingDetailsProps = {
  session: Session;
  mediaId: string;
};

function NowPlayingDetails({ session, mediaId }: NowPlayingDetailsProps) {
  const media = useLibraryData(() => getMedia(session, mediaId), [mediaId]);

  if (!media) return null;

  return (
    <View style={styles.container}>
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
    </View>
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
