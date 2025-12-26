import { Pressable, StyleSheet, Text, View } from "react-native";

import { PlayerProgressBar, TileImage, TileText } from "@/components";
import { getMedia } from "@/db/library";
import { useLibraryData } from "@/hooks/use-library-data";
import { expandPlayer, usePlayer } from "@/stores/player";
import { Session } from "@/stores/session";
import { Colors } from "@/styles";

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
