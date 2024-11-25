import NamesList from "@/src/components/NamesList";
import ThumbnailImage from "@/src/components/ThumbnailImage";
import { useMediaHeaderInfo } from "@/src/db/library";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { durationDisplay } from "@/src/utils/time";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

type HeaderProps = {
  mediaId: string;
  session: Session;
};

export default function Header({ mediaId, session }: HeaderProps) {
  const { media, opacity } = useMediaHeaderInfo(session, mediaId);

  if (!media) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <ThumbnailImage
        thumbnails={media.thumbnails}
        downloadedThumbnails={media.download?.thumbnails}
        size="extraLarge"
        style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
      />
      <View>
        <Text style={styles.titleText}>{media.book.title}</Text>
        {media.book.seriesBooks.length !== 0 && (
          <NamesList
            names={media.book.seriesBooks.map(
              (sb) => `${sb.series.name} #${sb.bookNumber}`,
            )}
            style={styles.seriesText}
          />
        )}
        <NamesList
          names={media.book.bookAuthors.map((ba) => ba.author.name)}
          style={styles.authorsText}
        />
        {media.mediaNarrators.length > 0 && (
          <NamesList
            prefix={
              media.fullCast ? "Read by a full cast including" : "Read by"
            }
            names={media.mediaNarrators.map((mn) => mn.narrator.name)}
            style={styles.narratorText}
          />
        )}
        {media.mediaNarrators.length === 0 && media.fullCast && (
          <Text style={styles.narratorText}>Read by a full cast</Text>
        )}
      </View>
      {media.duration && (
        <View>
          <Text style={styles.durationText}>
            {durationDisplay(media.duration)} {media.abridged && "(abridged)"}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  titleText: {
    fontSize: 22,
    color: Colors.zinc[100],
    fontWeight: "bold",
  },
  seriesText: {
    fontSize: 16,
    color: Colors.zinc[100],
  },
  authorsText: {
    fontSize: 16,
    color: Colors.zinc[300],
  },
  narratorText: {
    fontSize: 14,
    color: Colors.zinc[400],
  },
  durationText: {
    color: Colors.zinc[500],
    fontStyle: "italic",
  },
});
