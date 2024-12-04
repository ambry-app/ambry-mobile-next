import { BookDetailsText, ThumbnailImage } from "@/src/components";
import { useMediaHeaderInfo } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
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
  const shortScreen = useScreen((state) => state.shortScreen);
  const { media, opacity } = useMediaHeaderInfo(session, mediaId);

  if (!media) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <ThumbnailImage
        thumbnails={media.thumbnails}
        downloadedThumbnails={media.download?.thumbnails}
        size="extraLarge"
        style={{
          width: shortScreen ? "60%" : "90%",
          aspectRatio: 1,
          borderRadius: 12,
        }}
      />
      <View>
        <BookDetailsText
          textStyle={{ textAlign: "center" }}
          baseFontSize={16}
          titleWeight={700}
          title={media.book.title}
          series={media.book.seriesBooks.map(
            (sb) => `${sb.series.name} #${sb.bookNumber}`,
          )}
          authors={media.book.bookAuthors.map((ba) => ba.author.name)}
          narrators={media.mediaNarrators.map((mn) => mn.narrator.name)}
          fullCast={media.fullCast}
        />
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
    alignItems: "center",
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
