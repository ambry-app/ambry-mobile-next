import { BookDetailsText, ThumbnailImage } from "@/src/components";
import { MediaHeaderInfo } from "@/src/db/library";
import { useScreen } from "@/src/stores/screen";
import { Colors } from "@/src/styles";
import { durationDisplay } from "@/src/utils";
import { StyleSheet, Text, View } from "react-native";

type HeaderProps = {
  media: MediaHeaderInfo;
};

export function Header({ media }: HeaderProps) {
  const shortScreen = useScreen((state) => state.shortScreen);

  if (!media) return null;

  return (
    <View style={styles.container}>
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
          series={media.book.series.map((sb) => `${sb.name} #${sb.bookNumber}`)}
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
    </View>
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
