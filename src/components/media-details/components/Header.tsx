import {
  BookDetailsText,
  FadeInOnMount,
  ThumbnailImage,
} from "@/src/components";
import { useMediaHeaderInfo } from "@/src/hooks/library";
import { useScreen } from "@/src/stores/screen";
import { Session } from "@/src/stores/session";
import { Colors } from "@/src/styles";
import { durationDisplay } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";

type HeaderProps = {
  mediaId: string;
  session: Session;
};

export function Header(props: HeaderProps) {
  const { mediaId, session } = props;
  const shortScreen = useScreen((state) => state.shortScreen);
  const { media } = useMediaHeaderInfo(session, mediaId);

  if (!media) return null;

  return (
    <FadeInOnMount style={styles.container}>
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
            (sb) => `${sb.seriesName} #${sb.bookNumber}`,
          )}
          authors={media.book.authors.map((author) => author.name)}
          narrators={media.narrators.map((narrator) => narrator.name)}
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
    </FadeInOnMount>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
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
