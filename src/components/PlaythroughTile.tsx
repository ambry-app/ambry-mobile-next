import { PlaythroughWithMedia } from "@/src/db/library";
import useLoadMediaCallback from "@/src/hooks/use-load-media-callback";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { IconButton } from "./IconButton";
import { ProgressBar } from "./ProgressBar";
import { ThumbnailImage } from "./ThumbnailImage";
import { TileText } from "./Tiles";

type PlaythroughTileProps = {
  session: Session;
  playthrough: PlaythroughWithMedia;
  style?: StyleProp<ViewStyle>;
};

export const PlaythroughTile = React.memo(function PlaythroughTile(
  props: PlaythroughTileProps,
) {
  const { playthrough, style, session } = props;
  const loadMedia = useLoadMediaCallback(session, playthrough.media.id);
  const duration = playthrough.media.duration
    ? Number(playthrough.media.duration)
    : false;
  const percent = duration ? (playthrough.position / duration) * 100 : false;

  return (
    <Pressable onPress={loadMedia}>
      <View style={[styles.container, style]}>
        <View>
          <View style={styles.thumbnailContainer}>
            <ThumbnailImage
              thumbnails={playthrough.media.thumbnails}
              downloadedThumbnails={playthrough.media.download?.thumbnails}
              size="large"
              style={styles.thumbnail}
            />
            <IconButton
              icon="play"
              size={32}
              style={styles.playButton}
              iconStyle={styles.playButtonIcon}
              color={Colors.zinc[100]}
              onPress={loadMedia}
            />
          </View>
          {duration !== false && (
            <ProgressBar position={playthrough.position} duration={duration} />
          )}
          {percent !== false && (
            <Text style={styles.progressText} numberOfLines={1}>
              {percent.toFixed(1)}%
            </Text>
          )}
        </View>
        <TileText book={playthrough.media.book} media={[playthrough.media]} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    display: "flex",
    gap: 4,
  },
  thumbnailContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnail: {
    position: "absolute",
    width: "100%",
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  playButton: {
    elevation: 4,
    backgroundColor: Colors.zinc[900],
    borderRadius: 999,
  },
  playButtonIcon: {
    transform: [{ translateX: 2 }],
  },
  progressText: {
    fontSize: 14,
    color: Colors.zinc[400],
    textAlign: "center",
  },
});
